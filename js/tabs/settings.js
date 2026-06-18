import {
  INTENSITY_ICON,
  TARGETS,
  CALORIE_ACTIVITY_LEVELS,
  CALORIE_PROFILE_DEFAULTS,
  CALORIE_SEX,
  computeCalorieTargets,
  hydrateCalorieTargets,
  setCalorieDeficit,
  recommendMacros,
} from '../config.js'
import { state } from '../state.js'
import { supabase, db, getWorkoutConflictPreference, setWorkoutConflictPreference } from '../db.js'
import { fmt, round, cap } from '../utils.js'
import { openSheet, showToast, closeMenus, closeSheets } from '../ui.js'
import { claudeDraftConfirmationEnabled, setClaudeDraftConfirmationEnabled } from '../ai.js'
import { connectStrava, disconnectStrava, syncStrava, updateStravaSettingsSection, stravaAutoPushEnabled, stravaAutoPushGoogleEnabled, stravaSyncPaused, stravaWeightSyncEnabled, setStravaWeightSync } from '../strava.js'
import { connectGoogleHealth, disconnectGoogleHealth, syncGoogleHealth, updateGoogleHealthSettingsSection, ghAutoPushEnabled, ghSyncPaused, ghPushStravaImports, calibrateTDEETargets, googleHealthIsConnected } from '../google-health.js'
import { materialIcon } from '../icons.js'
import { showTutorial } from '../tutorial.js'
import { APP_VERSION } from '../version.js'

const STRAVA_ICON = materialIcon('directions_bike', 16)
const GOOGLE_HEALTH_ICON = materialIcon('monitor_heart', 16)
const CLAUDE_ICON = materialIcon('smart_toy', 16)
const FOOD_DB_ICON = materialIcon('database', 16)
const FOOD_PRESET_ICON = materialIcon('restaurant', 15)
const WORK_PRESET_ICON = materialIcon('fitness_center', 15)
const CHEVRON = materialIcon('expand_more', 16, { className: 'accordion-chevron' })

function section(key, title, body, defaultOpen = false) {
  return `
    <div class="accordion ${defaultOpen ? 'open' : ''}" data-section="${key}">
      <button type="button" class="accordion-header" data-action="toggle-section" data-section="${key}">
        <span class="accordion-title">${title}</span>
        ${CHEVRON}
      </button>
      <div class="accordion-body-wrap">
        <div class="accordion-body">
          <div class="accordion-body-inner">${body}</div>
        </div>
      </div>
    </div>`
}

function formatCalorieProfileSummary(targets, latestWeightKg) {
  if (!targets) {
    return 'Add age, sex, height, weight, and activity level to estimate your baseline calorie burn.'
  }

  const sexLabel = CALORIE_SEX[targets.sex]?.label || 'Other'
  const activity = CALORIE_ACTIVITY_LEVELS[targets.activity_level]?.label || 'Moderate'
  const weightLabel = Number.isFinite(targets.weight_kg)
    ? `${targets.weight_kg.toFixed(targets.weight_kg % 1 ? 2 : 0)} kg`
    : 'n/a'
  const usedLatest = latestWeightKg != null && targets.weight_kg === latestWeightKg

  return `
    <strong>${targets.rest.toLocaleString()} kcal/day</strong> estimated target.<br>
    BMR helper: ${targets.bmr.toLocaleString()} kcal · ${sexLabel} · ${targets.age} years · ${targets.height_cm} cm · ${weightLabel} · ${activity}${usedLatest ? ` · using latest logged weight (${latestWeightKg.toFixed(2)} kg)` : ''}.
  `
}

function withDeficit(rest, deficitKcal) {
  const deficit = Math.max(0, Number(deficitKcal) || 0)
  return Math.max(0, Math.round(rest - deficit))
}

function formatCalorieProfileSummaryWithDeficit(targets, latestWeightKg, deficitKcal = 0) {
  if (!targets) return formatCalorieProfileSummary(targets, latestWeightKg)

  const deficit = Math.max(0, Number(deficitKcal) || 0)
  if (!deficit) return formatCalorieProfileSummary(targets, latestWeightKg)

  const sexLabel = CALORIE_SEX[targets.sex]?.label || 'Other'
  const activity = CALORIE_ACTIVITY_LEVELS[targets.activity_level]?.label || 'Moderate'
  const weightLabel = Number.isFinite(targets.weight_kg)
    ? `${targets.weight_kg.toFixed(targets.weight_kg % 1 ? 2 : 0)} kg`
    : 'n/a'
  const usedLatest = latestWeightKg != null && targets.weight_kg === latestWeightKg
  const adjustedTarget = withDeficit(targets.rest, deficit)

  return `
    <strong>${adjustedTarget.toLocaleString()} kcal/day</strong> target after deficit.<br>
    Maintenance: ${targets.rest.toLocaleString()} kcal · Deficit: ${Math.round(deficit).toLocaleString()} kcal · BMR helper: ${targets.bmr.toLocaleString()} kcal · ${sexLabel} · ${targets.age} years · ${targets.height_cm} cm · ${weightLabel} · ${activity}${usedLatest ? ` · using latest logged weight (${latestWeightKg.toFixed(2)} kg)` : ''}.
  `
}

function setCalorieProfileSummary(targets, latestWeightKg, deficitKcal = 0) {
  const summary = document.getElementById('settings-profile-summary')
  if (!summary) return
  summary.innerHTML = formatCalorieProfileSummaryWithDeficit(targets, latestWeightKg, deficitKcal)
}

function updateProfileTargetInputs(targets) {
  if (!targets) return
  const restInput = document.getElementById('t-cal-rest')
  if (restInput) restInput.value = targets.rest
}

function sourcePills(sources, hidden = false) {
  const style = 'margin-top:10px;width:100%;' + (hidden ? 'display:none' : '')
  return '<div class="push-source-pills" style="' + style + '">'
    + '<span style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">Push from</span>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + sources.map(s =>
        '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--tx2);cursor:pointer;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:' + (s.checked ? 'var(--track)' : 'transparent') + '">'
        + '<input type="checkbox" data-source-key="' + s.key + '" style="accent-color:var(--accent);width:12px;height:12px"' + (s.checked ? ' checked' : '') + '>'
        + s.label
        + '</label>'
      ).join('')
    + '</div></div>'
}

function setTargetsReadonly(isReadonly) {
  const calInput = document.getElementById('t-cal-rest')
  if (calInput) calInput.disabled = !!isReadonly
  const saveBtn = document.getElementById('settings-save-targets-btn')
  if (saveBtn) saveBtn.style.display = isReadonly ? 'none' : ''
}

export async function renderSettings() {
  const panel = document.getElementById('settings-content')
  const versionEl = document.getElementById('settings-version')
  if (versionEl) versionEl.textContent = APP_VERSION

  if (!state.currentUser) {
    panel.innerHTML = `
      <div class="tab-inner">
        <div class="signin-prompt" style="margin:40px 0">
          <div class="signin-icon">${materialIcon('fitness_center', 28)}</div>
          <div class="signin-title">MyTracker</div>
          <div class="signin-sub">Sign in to access your data</div>
          <button class="github-signin-btn" data-action="signin">
            <span class="material-symbols-outlined" style="font-size:20px;vertical-align:-4px">login</span>
            Sign in with GitHub
          </button>
          <button class="github-signin-btn" data-action="signin-google" style="margin-top:10px; background: #4285F4; color: #fff;">
            <span class="material-symbols-outlined" style="font-size:20px;vertical-align:-4px">login</span>
            Sign in with Google
          </button>
        </div>
      </div>`
    return
  }

  let meals, wps, data, settingsRow
  try {
    ;[data, meals, wps] = await Promise.all([
      state.dbCache ? Promise.resolve(state.dbCache) : db.load(),
      db.loadMeals(),
      db.loadWorkoutPresets(),
    ])
    settingsRow = await db.loadSettings()
    state.mealsCache = meals
    state.workoutPresetsCache = wps
  } catch (e) {
    panel.innerHTML = `<div class="empty" style="margin-top:40px">Failed to load: ${e.message}</div>`
    return
  }

  const latestWeightKg = data?.weights?.[0]?.kg || null
  const bmrEnabledKey = `tracker-use-bmr:${state.currentUser.id}`
  const bmrDeficitKey = `tracker-bmr-deficit:${state.currentUser.id}`
  const useGHCalibration = settingsRow?.tdee_source === 'google-health'
  const useBmr = !useGHCalibration && (
    settingsRow?.use_bmr_target != null ? settingsRow.use_bmr_target : localStorage.getItem(bmrEnabledKey) !== 'false'
  )
  const rawDeficit = settingsRow?.bmr_deficit != null ? settingsRow.bmr_deficit : Number(localStorage.getItem(bmrDeficitKey) || 0)
  const bmrDeficit = Number.isFinite(rawDeficit) && rawDeficit >= 0 ? Math.round(rawDeficit) : 0

  const calorieProfile = {
    age: settingsRow?.age_years ?? '',
    sex: settingsRow?.sex ?? CALORIE_PROFILE_DEFAULTS.sex,
    height_cm: settingsRow?.height_cm ?? '',
    weight_kg: settingsRow?.weight_kg ?? '',
    activity_level: settingsRow?.activity_level ?? CALORIE_PROFILE_DEFAULTS.activity_level,
  }
  const profileHasValues = calorieProfile.age || calorieProfile.height_cm || calorieProfile.weight_kg
  const estimatedProfile = profileHasValues
    ? computeCalorieTargets(calorieProfile, latestWeightKg)
    : null

  const profileAge = calorieProfile.age || ''
  const profileSex = CALORIE_SEX[calorieProfile.sex] ? calorieProfile.sex : CALORIE_PROFILE_DEFAULTS.sex
  const profileHeight = calorieProfile.height_cm || ''
  const profileWeight = calorieProfile.weight_kg || (latestWeightKg ?? '')
  const profileActivity = CALORIE_ACTIVITY_LEVELS[calorieProfile.activity_level] ? calorieProfile.activity_level : CALORIE_PROFILE_DEFAULTS.activity_level
  const eatbackEnabled = settingsRow?.eatback_enabled ?? true
  const savedProteinPerKg = settingsRow?.protein_per_kg ?? null

  const mealItems = meals.map(m => `
    <div class="meal-preset-item">
      <div class="meal-preset-icon">${FOOD_PRESET_ICON}</div>
      <div class="meal-preset-body">
        <div class="meal-preset-name">${m.name}</div>
        <div class="meal-preset-meta">P ${fmt(m.protein || 0)}g · C ${fmt(m.carbs || 0)}g · F ${fmt(m.fat || 0)}g${m.meal ? ' · ' + cap(m.meal) : ''}</div>
      </div>
      <div class="meal-preset-cal">${round(m.calories)}<span style="font-size:10px;font-weight:400;color:var(--tx3)"> kcal</span></div>
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
        <div class="entry-menu">
          <button data-action="edit-preset" data-id="${m.id}">Edit</button>
          <button class="danger" data-action="delete-preset" data-id="${m.id}">Delete</button>
        </div>
      </div>
    </div>`).join('')

  const wpItems = wps.map(w => `
    <div class="meal-preset-item">
      <div class="meal-preset-icon">${WORK_PRESET_ICON}</div>
      <div class="meal-preset-body">
        <div class="meal-preset-name">${w.name}</div>
        <div class="meal-preset-meta">${INTENSITY_ICON[w.intensity] || INTENSITY_ICON.medium} ${cap(w.intensity || 'medium')}${w.calories_burned ? ' · ' + w.calories_burned + ' kcal burned' : ''}</div>
      </div>
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
        <div class="entry-menu">
          <button data-action="edit-workout-preset" data-id="${w.id}">Edit</button>
          <button class="danger" data-action="delete-workout-preset" data-id="${w.id}">Delete</button>
        </div>
      </div>
    </div>`).join('')

  const apiKey = localStorage.getItem('tracker-anthropic-key') || ''
  const fdcKey = localStorage.getItem('tracker-fdc-api-key') || ''

  const tdeeAt = settingsRow?.tdee_calibrated_at ?? null
  const tdeeCalibratedLabel = tdeeAt ? 'Last updated ' + new Date(tdeeAt).toLocaleDateString() + ' · auto-updates on sync' : 'Never calibrated · will run on save'

  const macroMode = localStorage.getItem('tracker-macro-mode') || 'g'
  const initCalGoal = TARGETS.calories.goal || TARGETS.calories.rest
  const initProteinPct = initCalGoal > 0 ? Math.round(TARGETS.protein * 4 / initCalGoal * 100) : 20
  const initCarbsPct   = initCalGoal > 0 ? Math.round(TARGETS.carbs   * 4 / initCalGoal * 100) : 45
  const initFatPct     = initCalGoal > 0 ? Math.round(TARGETS.fat     * 9 / initCalGoal * 100) : 35
  const initTotalPct   = initProteinPct + initCarbsPct + initFatPct

  panel.innerHTML = `<div class="tab-inner">

    ${section('presets', 'Presets', `
      <div class="section-label">Meals</div>
      <button class="meals-add-btn" data-action="add-meal-preset">+ Add meal preset</button>
      ${meals.length ? mealItems : '<div class="empty">No saved meals yet.</div>'}

      <div class="settings-section-divider"></div>

      <div class="section-label">Activities</div>
      <button class="meals-add-btn" data-action="add-workout-preset">+ Add activity preset</button>
      ${wps.length ? wpItems : '<div class="empty">No saved activities yet.</div>'}
    `)}

    ${section('targets', 'Calories', `
      <div id="settings-bmr-calc-section">
        <div class="toggle-row" style="margin-bottom:8px">
          <div class="toggle-row-label">Profile-based target</div>
          <label class="toggle-switch" for="settings-use-bmr-checkbox">
            <input type="checkbox" id="settings-use-bmr-checkbox" ${useBmr ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="toggle-row" style="margin-bottom:8px">
          <div>
            <div class="toggle-row-label">Activity eat-back</div>
            <div class="toggle-row-sub">Add a portion of logged workout calories back to your daily target.</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="eatback-toggle" ${eatbackEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="eatback-slider-section" style="display:${eatbackEnabled ? '' : 'none'};margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <input type="range" id="eatback-slider" min="0" max="100" step="5" value="${TARGETS.calories.eatback_pct}"
              style="flex:1;accent-color:var(--accent)">
            <span id="eatback-label" style="font-size:14px;font-weight:600;color:var(--tx);min-width:36px;text-align:right">${TARGETS.calories.eatback_pct}%</span>
          </div>
          <div style="font-size:11px;color:var(--tx3);margin-top:4px">50% recommended. Device burn estimates are often 20-40% too high.</div>
        </div>
        ${googleHealthIsConnected() ? `
        <div class="toggle-row" style="margin-bottom:8px">
          <div>
            <div class="toggle-row-label">Calibrate from Google Health</div>
            <div class="toggle-row-sub">${useGHCalibration ? tdeeCalibratedLabel : 'Use measured target instead of the profile estimate'}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="tdee-gh-toggle" ${useGHCalibration ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>` : ''}
      </div>

      <div class="form-field" style="margin-bottom:14px">
        <label class="form-label" for="t-cal-rest">Target (kcal)</label>
        <input class="form-input" id="t-cal-rest" type="number" inputmode="numeric" value="${TARGETS.calories.rest}" style="max-width:160px">
      </div>
      <button class="btn-integration" id="settings-save-targets-btn" style="display:${useBmr || useGHCalibration ? 'none' : ''}">Save</button>
      <button class="btn-integration" id="tdee-calibrate-btn" style="display:${useGHCalibration ? '' : 'none'}">
        ${materialIcon('monitor_heart', 14, { style: 'vertical-align:-2px;flex-shrink:0' })}
        Calibrate Now
      </button>

      <div id="settings-bmr-details" style="display:${useBmr ? 'block' : 'none'}">
        <div class="settings-profile-summary" id="settings-profile-summary" style="margin-top:6px">
          ${formatCalorieProfileSummaryWithDeficit(estimatedProfile, latestWeightKg, bmrDeficit)}
        </div>
        <div class="profile-grid">
          <div class="form-field">
            <label class="form-label" for="profile-age">Age (years)</label>
            <input class="form-input" id="profile-age" type="number" inputmode="numeric" min="13" max="120" value="${profileAge}">
          </div>
          <div class="form-field">
            <label class="form-label" for="profile-sex">Sex</label>
            <select class="form-input" id="profile-sex">
              <option value="female" ${profileSex === 'female' ? 'selected' : ''}>Female</option>
              <option value="male" ${profileSex === 'male' ? 'selected' : ''}>Male</option>
              <option value="other" ${profileSex === 'other' ? 'selected' : ''}>Other / prefer not to say</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="profile-height-cm">Height (cm)</label>
            <input class="form-input" id="profile-height-cm" type="number" inputmode="numeric" min="100" max="250" value="${profileHeight}">
          </div>
          <div class="form-field">
            <label class="form-label" for="profile-weight-kg">Weight (kg)</label>
            <input class="form-input" id="profile-weight-kg" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="${profileWeight}">
          </div>
          <div class="form-field">
            <label class="form-label" for="profile-activity-level">Daily movement</label>
            <select class="form-input" id="profile-activity-level"
              ${useBmr && eatbackEnabled ? 'disabled style="opacity:0.4"' : ''}>
              <option value="sedentary" ${(useBmr && eatbackEnabled) || profileActivity === 'sedentary' ? 'selected' : ''}>Sedentary</option>
              <option value="light" ${!(useBmr && eatbackEnabled) && profileActivity === 'light' ? 'selected' : ''}>Light</option>
              <option value="moderate" ${!(useBmr && eatbackEnabled) && profileActivity === 'moderate' ? 'selected' : ''}>Moderate</option>
              <option value="active" ${!(useBmr && eatbackEnabled) && profileActivity === 'active' ? 'selected' : ''}>Active</option>
              <option value="very_active" ${!(useBmr && eatbackEnabled) && profileActivity === 'very_active' ? 'selected' : ''}>Very active</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="profile-deficit-kcal">Deficit (kcal/day)</label>
            <input class="form-input" id="profile-deficit-kcal" type="number" inputmode="numeric" min="0" max="1500" step="10" value="${bmrDeficit}">
          </div>
        </div>
        <p class="settings-profile-note">This estimate includes everyday movement, so it behaves like a daily TDEE rather than workout-only calories.</p>
        <button class="btn-integration" id="settings-save-profile-btn" style="margin-top:4px">Save Profile</button>
      </div>

    `)}

    ${section('macros', 'Macros & Supplements', `

      <div class="macro-mode-bar">
        <div class="macro-mode-switcher">
          <button type="button" class="mode-seg ${macroMode === 'g' ? 'active' : ''}" data-macro-mode="g">g</button>
          <button type="button" class="mode-seg ${macroMode === 'pct' ? 'active' : ''}" data-macro-mode="pct">%</button>
        </div>
      </div>

      <div class="macros-boxes-grid">
        <div class="macro-box">
          <div class="macro-box-label">Protein</div>
          <div class="macro-box-input-wrap">
            <input class="macro-box-input" id="t-protein" type="number" inputmode="decimal"
              value="${macroMode === 'g' ? TARGETS.protein : initProteinPct}"
              ${savedProteinPerKg ? 'readonly' : ''}>
            <span class="macro-box-unit" id="macro-unit-protein">${macroMode === 'g' ? 'g' : '%'}</span>
          </div>
          <div class="macro-box-hint" id="t-protein-hint">${macroMode === 'pct' ? `= ${TARGETS.protein}g` : (savedProteinPerKg ? `from g/kg` : '')}</div>
          <div class="macro-box-perkg">
            <input class="macro-perkg-input" id="t-protein-per-kg" type="number" inputmode="decimal"
              step="0.1" min="0.5" max="4" placeholder="g / kg body weight"
              value="${savedProteinPerKg ?? ''}">
            <div class="macro-box-hint" id="t-protein-computed"></div>
          </div>
        </div>

        <div class="macro-box">
          <div class="macro-box-label">Carbs</div>
          <div class="macro-box-input-wrap">
            <input class="macro-box-input" id="t-carbs" type="number" inputmode="decimal"
              value="${macroMode === 'g' ? TARGETS.carbs : initCarbsPct}">
            <span class="macro-box-unit" id="macro-unit-carbs">${macroMode === 'g' ? 'g' : '%'}</span>
          </div>
          <div class="macro-box-hint" id="t-carbs-hint">${macroMode === 'pct' ? `= ${TARGETS.carbs}g` : ''}</div>
        </div>

        <div class="macro-box">
          <div class="macro-box-label">Fat</div>
          <div class="macro-box-input-wrap">
            <input class="macro-box-input" id="t-fat" type="number" inputmode="decimal"
              value="${macroMode === 'g' ? TARGETS.fat : initFatPct}">
            <span class="macro-box-unit" id="macro-unit-fat">${macroMode === 'g' ? 'g' : '%'}</span>
          </div>
          <div class="macro-box-hint" id="t-fat-hint">${macroMode === 'pct' ? `= ${TARGETS.fat}g` : ''}</div>
        </div>
      </div>

      <div id="macros-pct-total" class="macro-pct-total ${initTotalPct === 100 ? 'exact' : initTotalPct > 100 ? 'over' : ''}" style="display:${macroMode === 'pct' ? '' : 'none'}">
        Total: ${initTotalPct}%${initTotalPct !== 100 ? ` (${initTotalPct > 100 ? '+' : ''}${initTotalPct - 100}%)` : ' ✓'}
      </div>

      <div class="settings-section-divider"></div>

      <div class="toggle-row" style="margin-bottom:8px">
        <div>
          <div class="toggle-row-label">Track creatine</div>
          <div class="toggle-row-sub">Ring on the Today tab</div>
        </div>
        <label class="toggle-switch" for="track-supplements-toggle">
          <input type="checkbox" id="track-supplements-toggle" ${settingsRow?.track_supplements ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div id="targets-creatine-row" style="display:${settingsRow?.track_supplements ? '' : 'none'};margin-bottom:14px">
        <div class="form-field">
          <label class="form-label" for="t-creatine">Creatine daily target (g)</label>
          <input class="form-input" id="t-creatine" type="number" inputmode="decimal" step="0.5" min="1" max="20" value="${settingsRow?.creatine_target_g ?? 5}" style="max-width:120px">
        </div>
      </div>

      <button class="btn-integration" id="settings-save-macros-btn">Save Macros</button>

    `)}

    ${section('integrations', 'Integrations', `

      <div class="integration-label">${CLAUDE_ICON} Sonnet 4.6 API</div>
      <p class="setup-note">Your API key is stored locally and never sent anywhere except Anthropic's API.</p>
      <div class="form-field">
        <label class="form-label" for="settings-apikey-input">Anthropic API Key</label>
        <input class="form-input" id="settings-apikey-input" type="password"
          placeholder="sk-ant-…" autocomplete="off" value="${apiKey ? '••••••••' : ''}" />
      </div>
      <div class="toggle-row" style="margin:6px 0 10px">
        <div class="toggle-row-label" style="font-size:13px">Confirm drafts before saving</div>
        <label class="toggle-switch">
          <input type="checkbox" id="claude-confirm-toggle" ${claudeDraftConfirmationEnabled() ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <button class="btn-integration" id="settings-save-apikey-btn">Save Key</button>

      <div class="settings-section-divider"></div>

      <div class="integration-label">${FOOD_DB_ICON} Food Database</div>
      <p class="setup-note">
        Claude looks up real nutrition data (USDA FoodData Central + Open Food Facts, which covers European brands well) before estimating calories.
        Works out of the box with no setup. Only needed if you hit rate limits:
        <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank">get a free USDA key</a>.
      </p>
      <div class="form-field">
        <label class="form-label" for="settings-fdc-apikey-input">USDA API Key (optional)</label>
        <input class="form-input" id="settings-fdc-apikey-input" type="password"
          placeholder="DEMO_KEY" autocomplete="off" value="${fdcKey ? '••••••••' : ''}" />
      </div>
      <button class="btn-integration" id="settings-save-fdckey-btn">Save Key</button>

      <div class="settings-section-divider"></div>

      <div class="integration-label">${STRAVA_ICON} Strava</div>
      <div id="strava-disconnected-ui">
        <p class="setup-note">
          Connect your Strava account to automatically sync activities.
          By default, OAuth tokens are stored server-side in Supabase. Nothing sensitive is saved in your browser.
        </p>
        <div class="toggle-row" style="margin-bottom:4px">
          <div class="toggle-row-label" style="font-size:13px">Use custom API credentials (self-hosted)</div>
          <label class="toggle-switch">
            <input type="checkbox" id="strava-custom-cb" onchange="document.getElementById('strava-custom-fields').style.display = this.checked ? 'block' : 'none'">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="strava-custom-fields" style="display:none;margin-bottom:16px;padding:12px;background:var(--track);border-radius:8px">
          <p class="setup-note" style="margin-top:0">
            Connect your <a href="https://www.strava.com/settings/api" target="_blank">Strava API app</a>.
            Your client ID, client secret, and OAuth tokens are stored in your browser's <code>localStorage</code>. They never leave this device.
          </p>
          <div class="form-field">
            <label class="form-label" for="strava-cid-input">Client ID</label>
            <input class="form-input" id="strava-cid-input" type="text" placeholder="e.g. 12345" autocomplete="off" />
          </div>
          <div class="form-field" style="margin-bottom:0">
            <label class="form-label" for="strava-csecret-input">Client Secret</label>
            <input class="form-input" id="strava-csecret-input" type="password" placeholder="abc123…" autocomplete="off" />
          </div>
        </div>
        <button class="btn-strava" id="connect-strava-btn">
          ${STRAVA_ICON}
          Connect Strava
        </button>
      </div>
      <div id="strava-connected-ui" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span id="strava-athlete-label" style="font-size:14px;font-weight:600;color:var(--tx)">Connected</span>
          <button id="disconnect-strava-btn" class="link-btn">Disconnect</button>
        </div>
        <p id="strava-last-sync-label" class="setup-note" style="margin-bottom:10px">Last synced: never</p>
        <button class="btn-strava" id="force-sync-btn">
          ${materialIcon('sync', 14, { style: 'vertical-align:-2px;flex-shrink:0' })}
          Force Sync Now
        </button>
        <div class="toggle-row" style="margin-top:14px">
          <div>
            <div class="toggle-row-label">Pause sync</div>
            <div class="toggle-row-sub">Stop importing new activities from Strava</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="strava-pause-sync-toggle" ${stravaSyncPaused() ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="toggle-row" style="flex-wrap:wrap;gap:0">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
            <div>
              <div class="toggle-row-label">Auto push to Strava</div>
              <div class="toggle-row-sub">Automatically push activities to Strava</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="strava-auto-push-master" ${stravaAutoPushEnabled() || stravaAutoPushGoogleEnabled() ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          ${sourcePills([
            { key: 'manual',        label: 'Manual entries',        checked: stravaAutoPushEnabled() },
            { key: 'google-health', label: 'Google Health imports', checked: stravaAutoPushGoogleEnabled() },
          ], !stravaAutoPushEnabled() && !stravaAutoPushGoogleEnabled())}
        </div>
        <div class="toggle-row">
          <div>
            <div class="toggle-row-label">Sync weight</div>
            <div class="toggle-row-sub">Update Strava athlete weight when you log a weight entry</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="strava-sync-weight-toggle" ${stravaWeightSyncEnabled() ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <button id="remove-strava-btn" class="link-btn" style="margin-top:14px;color:var(--danger);display:block">Remove all synced activities</button>
      </div>

      <div class="settings-section-divider"></div>

      <div class="integration-label">${GOOGLE_HEALTH_ICON} Google Health</div>
      <div id="gh-disconnected-ui">
        <p class="setup-note">
          Connect your Google Health account to sync activities.
          By default, OAuth tokens are stored server-side in Supabase. Nothing sensitive is saved in your browser.
        </p>
        <div class="toggle-row" style="margin-bottom:4px">
          <div class="toggle-row-label" style="font-size:13px">Use custom API credentials (self-hosted)</div>
          <label class="toggle-switch">
            <input type="checkbox" id="gh-custom-cb" onchange="document.getElementById('gh-custom-fields').style.display = this.checked ? 'block' : 'none'">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="gh-custom-fields" style="display:none;margin-bottom:16px;padding:12px;background:var(--track);border-radius:8px">
          <p class="setup-note" style="margin-top:0">
            Sync activities via the <a href="https://console.cloud.google.com/apis/api/health.googleapis.com/" target="_blank">Google Health API Console</a>.
            Your client ID, client secret, and OAuth tokens are stored in your browser's <code>localStorage</code>. They never leave this device.
          </p>
          <p class="setup-note" style="margin-top:0">
            Create an OAuth 2.0 credential with redirect URI:
            <code style="font-size:11px;background:var(--bg);padding:1px 4px;border-radius:4px;word-break:break-all;display:inline-block;max-width:100%">${location.origin + location.pathname}</code>
          </p>
          <div class="form-field">
            <label class="form-label" for="gh-cid-input">Client ID</label>
            <input class="form-input" id="gh-cid-input" type="text" placeholder="123….apps.googleusercontent.com" autocomplete="off" />
          </div>
          <div class="form-field" style="margin-bottom:0">
            <label class="form-label" for="gh-csecret-input">Client Secret</label>
            <input class="form-input" id="gh-csecret-input" type="password" placeholder="GOCSPX-…" autocomplete="off" />
          </div>
        </div>
        <button class="btn-google-health" id="connect-gh-btn">
          ${GOOGLE_HEALTH_ICON}
          Connect with Google
        </button>
      </div>
      <div id="gh-connected-ui" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span id="gh-user-label" style="font-size:14px;font-weight:600;color:var(--tx)">Connected</span>
          <button id="disconnect-gh-btn" class="link-btn">Disconnect</button>
        </div>
        <p id="gh-last-sync-label" class="setup-note" style="margin-bottom:10px">Last synced: never</p>
        <button class="btn-google-health" id="gh-force-sync-btn">
          ${materialIcon('sync', 14, { style: 'vertical-align:-2px;flex-shrink:0' })}
          Force Sync Now
        </button>
        <div class="toggle-row" style="margin-top:14px">
          <div>
            <div class="toggle-row-label">Pause sync</div>
            <div class="toggle-row-sub">Stop importing new activities from Google Health</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="gh-pause-sync-toggle" ${ghSyncPaused() ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="toggle-row" style="flex-wrap:wrap;gap:0">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
            <div>
              <div class="toggle-row-label">Auto push to Google Health</div>
              <div class="toggle-row-sub">Automatically push activities to Google Health</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="gh-auto-push-master" ${ghAutoPushEnabled() || ghPushStravaImports() ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          ${sourcePills([
            { key: 'manual', label: 'Manual entries',  checked: ghAutoPushEnabled() },
            { key: 'strava', label: 'Strava imports',  checked: ghPushStravaImports() },
          ], !ghAutoPushEnabled() && !ghPushStravaImports())}
        </div>
        <button id="remove-gh-btn" class="link-btn" style="margin-top:14px;color:var(--danger);display:block">Remove all synced activities</button>
      </div>

      <div class="settings-section-divider"></div>

      <div class="integration-label">${materialIcon('swap_horiz', 14)} Activity Conflicts</div>
      <p class="setup-note">When Strava and Google Health overlap, only the selected source counts toward metrics. You can swap any inactive duplicate from its card.</p>
      <div class="form-field">
        <label class="form-label" for="conflict-preference">Default source</label>
        <select class="form-input" id="conflict-preference">
          <option value="strava">Strava</option>
          <option value="google-health">Google Health</option>
        </select>
      </div>

    `)}

    ${section('account', 'Account', `
      <p class="setup-note">Signed in as ${state.currentUser.email || state.currentUser.user_metadata?.user_name || 'GitHub user'} via Supabase Auth. Your data is stored securely in a private Supabase database and synced across devices.</p>
      <button class="btn-integration" id="settings-tutorial-btn" style="margin-top:16px">Show tutorial again</button>
      <button class="btn-integration" id="settings-signout-btn" style="margin-top:10px;color:var(--danger)">Sign out</button>
    `)}

    <div style="display:flex; flex-direction:column; align-items:center; margin-top:32px; margin-bottom:16px; gap:10px">
      <a href="help/" target="_blank" class="settings-docs-btn" data-tip="Documentation">
        <span class="material-symbols-outlined" style="font-size:15px">menu_book</span>
        Docs
      </a>
      <div style="font-size:12px; color:var(--tx3); line-height:1.7; text-align:center">
        Made by <strong style="color:var(--tx2)">Gonçalo Nespral</strong><br>
        <a href="https://gonespral.github.io" target="_blank" style="color:var(--tx2); text-decoration:none">Portfolio</a> &nbsp;·&nbsp;
        <a href="https://github.com/gonespral" target="_blank" style="color:var(--tx2); text-decoration:none">GitHub</a>
      </div>
    </div>

  </div>`

  const conflictPreference = document.getElementById('conflict-preference')
  if (conflictPreference) conflictPreference.value = getWorkoutConflictPreference()

  const useBmrCheckbox = document.getElementById('settings-use-bmr-checkbox')
  const deficitInput = document.getElementById('profile-deficit-kcal')

  const getEstimatedFromInputs = () => {
    const profile = {
      age: document.getElementById('profile-age')?.value,
      sex: document.getElementById('profile-sex')?.value,
      height_cm: document.getElementById('profile-height-cm')?.value,
      weight_kg: document.getElementById('profile-weight-kg')?.value || latestWeightKg || '',
      activity_level: document.getElementById('profile-activity-level')?.value,
    }
    return computeCalorieTargets(profile, latestWeightKg)
  }

  const getDeficitValue = () => Math.max(0, parseInt(deficitInput?.value, 10) || 0)

  const syncPctHints = () => {
    const mode = localStorage.getItem('tracker-macro-mode') || 'g'
    const el = (id) => document.getElementById(id)
    const totalEl = el('macros-pct-total')
    if (mode !== 'pct') {
      if (el('t-protein-hint')) el('t-protein-hint').textContent = ''
      if (el('t-carbs-hint'))   el('t-carbs-hint').textContent   = ''
      if (el('t-fat-hint'))     el('t-fat-hint').textContent     = ''
      if (totalEl) totalEl.style.display = 'none'
      return
    }
    const cal = TARGETS.calories.goal || TARGETS.calories.rest
    if (!cal) return
    const pp = parseInt(el('t-protein')?.value) || 0
    const cp = parseInt(el('t-carbs')?.value)   || 0
    const fp = parseInt(el('t-fat')?.value)     || 0
    if (el('t-protein-hint')) el('t-protein-hint').textContent = '= ' + Math.round(cal * pp / 100 / 4) + 'g'
    if (el('t-carbs-hint'))   el('t-carbs-hint').textContent   = '= ' + Math.round(cal * cp / 100 / 4) + 'g'
    if (el('t-fat-hint'))     el('t-fat-hint').textContent     = '= ' + Math.round(cal * fp / 100 / 9) + 'g'
    const total = pp + cp + fp
    if (totalEl) {
      totalEl.style.display = ''
      totalEl.textContent = 'Total: ' + total + '%' + (total !== 100 ? ' (' + (total > 100 ? '+' : '') + (total - 100) + '%)' : ' ✓')
      totalEl.className = 'macro-pct-total' + (total === 100 ? ' exact' : total > 100 ? ' over' : '')
    }
  }

  const applyEstimatedToTargets = (estimated) => {
    if (!estimated) return
    TARGETS.calories.rest = estimated.rest
    TARGETS.calories.bmr = estimated.bmr
    const goal = setCalorieDeficit(getDeficitValue())
    TARGETS.calories.training = goal
    updateProfileTargetInputs(estimated)
    setCalorieProfileSummary(estimated, latestWeightKg, getDeficitValue())
    syncPctHints()
  }

  const bmrDetails = document.getElementById('settings-bmr-details')

  const syncEatbackActivityLock = (enabled) => {
    const activitySelect = document.getElementById('profile-activity-level')
    const isBmrOn = document.getElementById('settings-use-bmr-checkbox')?.checked
    if (activitySelect && isBmrOn) {
      if (enabled) {
        activitySelect.value = 'sedentary'
        activitySelect.disabled = true
        activitySelect.style.opacity = '0.4'
        db.saveSettings({ activity_level: 'sedentary' }).catch(() => {})
      } else {
        activitySelect.disabled = false
        activitySelect.style.opacity = ''
      }
    }
  }

  const syncBmrUiState = () => {
    const enabled = !!useBmrCheckbox?.checked
    if (enabled) {
      // turn off GH calibration if active
      const ghToggle = document.getElementById('tdee-gh-toggle')
      if (ghToggle?.checked) {
        ghToggle.checked = false
        db.saveSettings({ tdee_source: null, tdee_calibrated_at: null }).catch(() => {})
        document.getElementById('tdee-calibrate-btn').style.display = 'none'
      }
    }
    if (bmrDetails) bmrDetails.style.display = enabled ? 'block' : 'none'
    setTargetsReadonly(enabled)
    document.getElementById('settings-save-targets-btn').style.display = enabled ? 'none' : ''
    state.settings.use_bmr_target = !!enabled
    db.saveSettings({ use_bmr_target: !!enabled }).catch(() => {})
    const eatbackOn = document.getElementById('eatback-toggle')?.checked
    syncEatbackActivityLock(enabled && eatbackOn)
    if (!enabled) return
    applyEstimatedToTargets(getEstimatedFromInputs() || estimatedProfile)
  }

  setTargetsReadonly(useBmr || useGHCalibration)
  setCalorieProfileSummary(estimatedProfile, latestWeightKg, bmrDeficit)
  setCalorieDeficit(bmrDeficit)
  if (useBmr && estimatedProfile) {
    applyEstimatedToTargets(estimatedProfile)
  }

  // Populate Strava + Google Health section state
  updateStravaSettingsSection()
  updateGoogleHealthSettingsSection()

  // Live g/kg → protein g computation
  const syncProteinFromPerKg = () => {
    const perKgInput = document.getElementById('t-protein-per-kg')
    const proInput = document.getElementById('t-protein')
    const computedEl = document.getElementById('t-protein-computed')
    const perKg = parseFloat(perKgInput?.value)
    const weightKg = parseFloat(document.getElementById('profile-weight-kg')?.value) || latestWeightKg || null
    if (perKg > 0 && weightKg) {
      const computed = Math.round(perKg * weightKg)
      if (proInput) { proInput.value = computed; proInput.readOnly = true; proInput.style.opacity = '0.5' }
      if (computedEl) computedEl.textContent = '= ' + computed + 'g at ' + weightKg.toFixed(1) + 'kg'
    } else {
      if (proInput) { proInput.readOnly = false; proInput.style.opacity = '' }
      if (computedEl) computedEl.textContent = ''
    }
  }
  document.getElementById('t-protein-per-kg')?.addEventListener('input', syncProteinFromPerKg)
  syncProteinFromPerKg()

  useBmrCheckbox?.addEventListener('change', syncBmrUiState)
  deficitInput?.addEventListener('input', () => {
    const value = getDeficitValue()
    state.settings.bmr_deficit = value
    db.saveSettings({ bmr_deficit: value }).catch(() => {})
    if (useBmrCheckbox?.checked) applyEstimatedToTargets(getEstimatedFromInputs())
  })
  ;['profile-age', 'profile-sex', 'profile-height-cm', 'profile-weight-kg', 'profile-activity-level'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (id === 'profile-weight-kg') syncProteinFromPerKg()
      if (useBmrCheckbox?.checked) applyEstimatedToTargets(getEstimatedFromInputs())
    })
    document.getElementById(id)?.addEventListener('change', () => {
      if (id === 'profile-weight-kg') syncProteinFromPerKg()
      if (useBmrCheckbox?.checked) applyEstimatedToTargets(getEstimatedFromInputs())
    })
  })

  // Supplement toggle
  document.getElementById('track-supplements-toggle')?.addEventListener('change', async (e) => {
    const enabled = e.target.checked
    document.getElementById('targets-creatine-row').style.display = enabled ? '' : 'none'
    state.settings.track_supplements = enabled
    await db.saveSettings({ track_supplements: enabled }).catch(() => {})
  })

  document.getElementById('settings-save-targets-btn').addEventListener('click', async () => {
    const calRest = parseInt(document.getElementById('t-cal-rest').value) || TARGETS.calories.rest
    TARGETS.calories.rest = calRest
    try {
      await db.saveSettings({ cal_rest: calRest })
      showToast('✅ Calorie target saved')
      document.dispatchEvent(new Event('targets-changed'))
    } catch (e) { showToast('❌ ' + e.message) }
  })

  // Mode switcher — converts input values when toggling g ↔ %
  document.querySelectorAll('[data-macro-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newMode = btn.dataset.macroMode
      const oldMode = localStorage.getItem('tracker-macro-mode') || 'g'
      if (newMode === oldMode) return
      const cal = TARGETS.calories.goal || TARGETS.calories.rest
      const pEl = document.getElementById('t-protein')
      const cEl = document.getElementById('t-carbs')
      const fEl = document.getElementById('t-fat')
      if (newMode === 'pct' && cal > 0) {
        if (pEl) pEl.value = Math.round((parseInt(pEl.value) || TARGETS.protein) * 4 / cal * 100)
        if (cEl) cEl.value = Math.round((parseInt(cEl.value) || TARGETS.carbs)   * 4 / cal * 100)
        if (fEl) fEl.value = Math.round((parseInt(fEl.value) || TARGETS.fat)     * 9 / cal * 100)
      } else if (newMode === 'g' && cal > 0) {
        if (pEl) pEl.value = Math.round(cal * (parseInt(pEl.value) || initProteinPct) / 100 / 4)
        if (cEl) cEl.value = Math.round(cal * (parseInt(cEl.value) || initCarbsPct)   / 100 / 4)
        if (fEl) fEl.value = Math.round(cal * (parseInt(fEl.value) || initFatPct)     / 100 / 9)
      }
      ;['protein', 'carbs', 'fat'].forEach(m => {
        const unitEl = document.getElementById('macro-unit-' + m)
        if (unitEl) unitEl.textContent = newMode === 'g' ? 'g' : '%'
      })
      localStorage.setItem('tracker-macro-mode', newMode)
      document.querySelectorAll('[data-macro-mode]').forEach(b => b.classList.toggle('active', b.dataset.macroMode === newMode))
      syncPctHints()
    })
  })

  ;['t-protein', 't-carbs', 't-fat'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', syncPctHints))
  syncPctHints()

  document.getElementById('settings-save-macros-btn')?.addEventListener('click', async () => {
    const mode = localStorage.getItem('tracker-macro-mode') || 'g'
    const cal = TARGETS.calories.goal || TARGETS.calories.rest
    let protein, carbs, fat, proteinPerKg = null

    const perKgRaw = parseFloat(document.getElementById('t-protein-per-kg')?.value)
    proteinPerKg = perKgRaw > 0 ? perKgRaw : null
    const weightKgForSave = parseFloat(document.getElementById('profile-weight-kg')?.value) || latestWeightKg || null

    if (mode === 'pct') {
      const pp = parseInt(document.getElementById('t-protein')?.value) || 0
      const cp = parseInt(document.getElementById('t-carbs')?.value)   || 0
      const fp = parseInt(document.getElementById('t-fat')?.value)     || 0
      protein = proteinPerKg && weightKgForSave
        ? Math.round(proteinPerKg * weightKgForSave)
        : Math.round(cal * pp / 100 / 4)
      carbs = Math.round(cal * cp / 100 / 4)
      fat   = Math.round(cal * fp / 100 / 9)
    } else {
      protein = parseInt(document.getElementById('t-protein')?.value) || TARGETS.protein
      carbs   = parseInt(document.getElementById('t-carbs')?.value)   || TARGETS.carbs
      fat     = parseInt(document.getElementById('t-fat')?.value)     || TARGETS.fat
      if (proteinPerKg && weightKgForSave) protein = Math.round(proteinPerKg * weightKgForSave)
    }

    const creatineRaw = parseFloat(document.getElementById('t-creatine')?.value)
    const creatineTarget = creatineRaw > 0 ? creatineRaw : null

    TARGETS.protein = protein
    TARGETS.carbs   = carbs
    TARGETS.fat     = fat
    TARGETS.protein_per_kg = proteinPerKg

    try {
      await db.saveSettings({
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        protein_per_kg: proteinPerKg,
        ...(creatineTarget != null ? { creatine_target_g: creatineTarget } : {}),
      })
      if (creatineTarget != null) state.settings.creatine_target_g = creatineTarget
      showToast('✅ Macros saved')
      document.dispatchEvent(new Event('targets-changed'))
    } catch (e) { showToast('❌ ' + e.message) }
  })

  document.getElementById('settings-save-profile-btn')?.addEventListener('click', async () => {
    const useBmrNow = !!useBmrCheckbox?.checked
    const deficitNow = getDeficitValue()
    state.settings.use_bmr_target = useBmrNow
    state.settings.bmr_deficit = deficitNow

    const profile = {
      age_years: document.getElementById('profile-age').value,
      sex: document.getElementById('profile-sex').value,
      height_cm: document.getElementById('profile-height-cm').value,
      weight_kg: document.getElementById('profile-weight-kg').value,
      activity_level: document.getElementById('profile-activity-level').value,
    }

    const resolvedWeight = profile.weight_kg || latestWeightKg || ''
    const estimated = computeCalorieTargets({
      age: profile.age_years,
      sex: profile.sex,
      height_cm: profile.height_cm,
      weight_kg: resolvedWeight,
      activity_level: profile.activity_level,
    }, latestWeightKg)
    if (!estimated) {
      showToast('❌ Enter age, height, and weight to calculate TDEE')
      return
    }

    TARGETS.calories.rest = estimated.rest
    TARGETS.calories.bmr = estimated.bmr
    const goal = setCalorieDeficit(deficitNow)
    TARGETS.calories.training = goal
    updateProfileTargetInputs(estimated)
    setCalorieProfileSummary(estimated, latestWeightKg, deficitNow)
    syncPctHints()

    try {
      await db.saveSettings({
        cal_rest: TARGETS.calories.rest,
        cal_training: TARGETS.calories.training,
        age_years: profile.age_years,
        sex: profile.sex,
        height_cm: profile.height_cm,
        weight_kg: resolvedWeight,
        activity_level: profile.activity_level,
        bmr_deficit: deficitNow,
        use_bmr_target: useBmrNow,
      })
      showToast('✅ Profile saved')
      document.dispatchEvent(new Event('targets-changed'))
    } catch (e) {
      showToast('❌ ' + e.message)
    }
  })

  document.getElementById('settings-save-apikey-btn').addEventListener('click', () => {
    const inp = document.getElementById('settings-apikey-input')
    const key = inp.value.trim()
    if (!key || key.startsWith('•')) return
    localStorage.setItem('tracker-anthropic-key', key)
    inp.value = '••••••••'
    showToast('✅ API key saved')
  })

  document.getElementById('settings-save-fdckey-btn')?.addEventListener('click', () => {
    const inp = document.getElementById('settings-fdc-apikey-input')
    const key = inp.value.trim()
    if (!key || key.startsWith('•')) return
    localStorage.setItem('tracker-fdc-api-key', key)
    inp.value = '••••••••'
    showToast('✅ USDA key saved')
  })

  document.getElementById('claude-confirm-toggle')?.addEventListener('change', e => {
    setClaudeDraftConfirmationEnabled(e.target.checked)
    showToast(e.target.checked ? '✅ Claude draft confirmation enabled' : 'Claude drafts will save automatically')
  })

  // Lock on initial render if both are already enabled
  if (eatbackEnabled && (useBmr || useGHCalibration)) syncEatbackActivityLock(true)

  document.getElementById('eatback-toggle')?.addEventListener('change', e => {
    const enabled = e.target.checked
    document.getElementById('eatback-slider-section').style.display = enabled ? '' : 'none'
    TARGETS.calories.eatback_enabled = enabled
    state.settings.eatback_enabled = enabled
    db.saveSettings({ eatback_enabled: enabled }).catch(() => {})
    syncEatbackActivityLock(enabled)
    document.dispatchEvent(new Event('targets-changed'))
  })

  document.getElementById('eatback-slider')?.addEventListener('input', e => {
    const pct = Number(e.target.value)
    document.getElementById('eatback-label').textContent = pct + '%'
    TARGETS.calories.eatback_pct = pct
    state.settings.eatback_pct = pct
    db.saveSettings({ eatback_pct: pct }).catch(() => {})
    document.dispatchEvent(new Event('targets-changed'))
  })

  conflictPreference?.addEventListener('change', async (event) => {
    setWorkoutConflictPreference(event.target.value)
    db.bust()
    document.dispatchEvent(new Event('workout-conflict-pref-changed'))
    showToast('✅ Default activity source updated')
  })

  document.getElementById('strava-pause-sync-toggle')?.addEventListener('change', e => {
    state.settings.strava_sync_paused = e.target.checked
    db.saveSettings({ strava_sync_paused: e.target.checked }).catch(() => {})
    showToast(e.target.checked ? '⏸ Strava sync paused' : '▶ Strava sync resumed')
  })

  document.getElementById('strava-auto-push-google-toggle')?.addEventListener('change', e => {
    state.settings.strava_auto_push_google = e.target.checked
    db.saveSettings({ strava_auto_push_google: e.target.checked }).catch(() => {})
    showToast(e.target.checked ? '✅ Google Health auto push enabled' : 'Google Health auto push disabled')
  })

  document.getElementById('strava-sync-weight-toggle')?.addEventListener('change', e => {
    setStravaWeightSync(e.target.checked)
    showToast(e.target.checked ? '✅ Weight sync enabled' : 'Weight sync disabled')
  })

  document.getElementById('connect-strava-btn').addEventListener('click', connectStrava)

  document.getElementById('disconnect-strava-btn')?.addEventListener('click', disconnectStrava)

  document.getElementById('force-sync-btn')?.addEventListener('click', async () => {
    closeSheets()
    await syncStrava({})
  })

  document.getElementById('remove-strava-btn')?.addEventListener('click', async () => {
    if (!confirm('Remove all Strava-synced activities from the tracker? They will re-sync on next load.')) return
    try {
      await db.deleteStravaWorkouts()
      showToast('🗑️ Strava activities removed')
      closeSheets()
    } catch (e) { showToast('❌ ' + e.message) }
  })

  document.getElementById('tdee-gh-toggle')?.addEventListener('change', async e => {
    if (e.target.checked) {
      const bmrCb = document.getElementById('settings-use-bmr-checkbox')
      if (bmrCb) bmrCb.checked = false
      state.settings.use_bmr_target = false
      db.saveSettings({ use_bmr_target: false }).catch(() => {})
      document.getElementById('settings-bmr-details').style.display = 'none'
      setTargetsReadonly(true)
      document.getElementById('settings-save-targets-btn').style.display = 'none'
      document.getElementById('tdee-calibrate-btn').style.display = ''
      await db.saveSettings({ tdee_source: 'google-health' }).catch(() => {})
    } else {
      try {
        await db.saveSettings({ tdee_source: null, tdee_calibrated_at: null })
        setTargetsReadonly(false)
        document.getElementById('settings-save-targets-btn').style.display = ''
        document.getElementById('tdee-calibrate-btn').style.display = 'none'
      } catch (e) { showToast('❌ ' + e.message) }
    }
  })

  document.getElementById('tdee-calibrate-btn')?.addEventListener('click', async () => {
    await calibrateTDEETargets({ silent: false })
    renderSettings()
  })

  document.getElementById('connect-gh-btn').addEventListener('click', connectGoogleHealth)

  document.getElementById('disconnect-gh-btn')?.addEventListener('click', disconnectGoogleHealth)

  document.getElementById('gh-force-sync-btn')?.addEventListener('click', async () => {
    closeSheets()
    await syncGoogleHealth({})
  })

  document.getElementById('remove-gh-btn')?.addEventListener('click', async () => {
    if (!confirm('Remove all Google Health-synced activities from the tracker? They will re-sync on next load.')) return
    try {
      await db.deleteGoogleHealthWorkouts()
      showToast('🗑️ Google Health activities removed')
      closeSheets()
    } catch (e) { showToast('❌ ' + e.message) }
  })

  document.getElementById('gh-pause-sync-toggle')?.addEventListener('change', e => {
    state.settings.gh_sync_paused = e.target.checked
    db.saveSettings({ gh_sync_paused: e.target.checked }).catch(() => {})
    showToast(e.target.checked ? '⏸ Google Health sync paused' : '▶ Google Health sync resumed')
  })

  // Strava master push toggle
  document.getElementById('strava-auto-push-master')?.addEventListener('change', e => {
    const pills = e.target.closest('.toggle-row')?.querySelector('.push-source-pills')
    if (e.target.checked) {
      if (!stravaAutoPushEnabled() && !stravaAutoPushGoogleEnabled()) {
        state.settings.strava_auto_push = true
        db.saveSettings({ strava_auto_push: true }).catch(() => {})
        const manualCb = pills?.querySelector('[data-source-key="manual"]')
        if (manualCb) { manualCb.checked = true; manualCb.closest('label').style.background = 'var(--track)' }
      }
      if (pills) pills.style.display = ''
    } else {
      state.settings.strava_auto_push = false
      state.settings.strava_auto_push_google = false
      db.saveSettings({ strava_auto_push: false, strava_auto_push_google: false }).catch(() => {})
      pills?.querySelectorAll('[data-source-key]').forEach(cb => { cb.checked = false; cb.closest('label').style.background = 'transparent' })
      if (pills) pills.style.display = 'none'
    }
  })

  document.querySelector('[data-source-key="manual"][id]')  // handled below via delegation

  // Strava source pill changes
  document.getElementById('strava-connected-ui')?.querySelectorAll('[data-source-key]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.dataset.sourceKey === 'manual') { state.settings.strava_auto_push = cb.checked; db.saveSettings({ strava_auto_push: cb.checked }).catch(() => {}) }
      if (cb.dataset.sourceKey === 'google-health') { state.settings.strava_auto_push_google = cb.checked; db.saveSettings({ strava_auto_push_google: cb.checked }).catch(() => {}) }
      cb.closest('label').style.background = cb.checked ? 'var(--track)' : 'transparent'
      // Sync master toggle
      const master = document.getElementById('strava-auto-push-master')
      if (master) master.checked = stravaAutoPushEnabled() || stravaAutoPushGoogleEnabled()
    })
  })

  // GH master push toggle
  document.getElementById('gh-auto-push-master')?.addEventListener('change', e => {
    const pills = e.target.closest('.toggle-row')?.querySelector('.push-source-pills')
    if (e.target.checked) {
      if (!ghAutoPushEnabled() && !ghPushStravaImports()) {
        state.settings.gh_auto_push = true
        db.saveSettings({ gh_auto_push: true }).catch(() => {})
        const manualCb = pills?.querySelector('[data-source-key="manual"]')
        if (manualCb) { manualCb.checked = true; manualCb.closest('label').style.background = 'var(--track)' }
      }
      if (pills) pills.style.display = ''
    } else {
      state.settings.gh_auto_push = false
      state.settings.gh_push_strava = false
      db.saveSettings({ gh_auto_push: false, gh_push_strava: false }).catch(() => {})
      pills?.querySelectorAll('[data-source-key]').forEach(cb => { cb.checked = false; cb.closest('label').style.background = 'transparent' })
      if (pills) pills.style.display = 'none'
    }
  })

  // GH source pill changes
  document.getElementById('gh-connected-ui')?.querySelectorAll('[data-source-key]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.dataset.sourceKey === 'manual') { state.settings.gh_auto_push = cb.checked; db.saveSettings({ gh_auto_push: cb.checked }).catch(() => {}) }
      if (cb.dataset.sourceKey === 'strava') { state.settings.gh_push_strava = cb.checked; db.saveSettings({ gh_push_strava: cb.checked }).catch(() => {}) }
      cb.closest('label').style.background = cb.checked ? 'var(--track)' : 'transparent'
      const master = document.getElementById('gh-auto-push-master')
      if (master) master.checked = ghAutoPushEnabled() || ghPushStravaImports()
    })
  })

  document.getElementById('settings-tutorial-btn')?.addEventListener('click', () => {
    closeSheets()
    showTutorial()
  })

  document.getElementById('settings-signout-btn').addEventListener('click', async () => {
    if (!confirm('Sign out?')) return
    closeSheets()
    await supabase.auth.signOut()
  })
}

export function openPresetSheet(id) {
  closeSheets()
  state.pendingEditPresetId = id
  state.returnToSheetId = 'settings-sheet'
  const m = id ? (state.mealsCache || []).find(x => x.id === id) : null
  document.getElementById('meal-preset-title').textContent = m ? 'Edit Meal' : 'New Meal'
  document.getElementById('mp-name').value = m?.name || ''
  document.getElementById('mp-cal').value = m?.calories || ''
  document.getElementById('mp-pro').value = m?.protein || ''
  document.getElementById('mp-car').value = m?.carbs || ''
  document.getElementById('mp-fat').value = m?.fat || ''
  document.querySelectorAll('#mp-meal-btns .meal-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.meal === (m?.meal || 'snack')))
  document.getElementById('save-preset-btn').textContent = m ? 'Update Meal' : 'Save Meal'
  document.getElementById('mp-name-ac')?.classList.remove('open')
  openSheet('meal-preset-sheet')
}

export async function deletePreset(id) {
  closeMenus()
  try {
    await db.deleteMeal(id)
    state.mealsCache = null
    showToast('🗑️ Meal deleted')
    renderSettings()
  } catch (e) { showToast('❌ ' + e.message) }
}

export function openWorkoutPresetSheet(id) {
  closeSheets()
  state.pendingEditWorkoutPresetId = id
  state.returnToSheetId = 'settings-sheet'
  const w = id ? (state.workoutPresetsCache || []).find(x => x.id === id) : null
  document.getElementById('wps-title').textContent = w ? 'Edit Activity' : 'New Activity'
  document.getElementById('wps-name').value = w?.name || ''
  document.getElementById('wps-calories-burned').value = w?.calories_burned || ''
  document.querySelectorAll('#wps-intensity-btns .intensity-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.intensity === (w?.intensity || 'medium')))
  document.getElementById('save-wps-btn').textContent = w ? 'Update Activity' : 'Save Activity'
  document.getElementById('wps-name-ac')?.classList.remove('open')
  openSheet('workout-preset-sheet')
}

export async function deleteWorkoutPreset(id) {
  closeMenus()
  try {
    await db.deleteWorkoutPreset(id)
    state.workoutPresetsCache = null
    showToast('🗑️ Activity deleted')
    renderSettings()
  } catch (e) { showToast('❌ ' + e.message) }
}

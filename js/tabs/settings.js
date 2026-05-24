import { INTENSITY_ICON, TARGETS } from '../config.js'
import { state } from '../state.js'
import { supabase, db } from '../db.js'
import { fmt, round, cap } from '../utils.js'
import { openSheet, showToast, closeMenus, closeSheets } from '../ui.js'
import { connectStrava, disconnectStrava, syncStrava, updateStravaSettingsSection } from '../strava.js'
import { connectGoogleHealth, disconnectGoogleHealth, syncGoogleHealth, updateGoogleHealthSettingsSection } from '../google-health.js'

const FOOD_PRESET_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`
const WORK_PRESET_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4M6 9h12M6 15h12"/></svg>`
const STRAVA_S_SVG    = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FC4C02" style="vertical-align:-2px;flex-shrink:0"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 0 18.428h4.172"/></svg>`
const GOOGLE_HEALTH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:-2px;flex-shrink:0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#4285F4"/></svg>`
const CHEVRON = `<svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`

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

export async function renderSettings() {
  const panel = document.getElementById('settings-content')

  if (!state.currentUser) {
    panel.innerHTML = `
      <div class="tab-inner">
        <div class="signin-prompt" style="margin:40px 0">
          <div class="signin-icon">🚴</div>
          <div class="signin-title">MyTracker</div>
          <div class="signin-sub">Sign in to access your data</div>
          <button class="github-signin-btn" data-action="signin">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.57C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
            Sign in with GitHub
          </button>
        </div>
      </div>`
    return
  }

  let meals, wps
  try {
    ;[meals, wps] = await Promise.all([db.loadMeals(), db.loadWorkoutPresets()])
    state.mealsCache          = meals
    state.workoutPresetsCache = wps
  } catch (e) {
    panel.innerHTML = `<div class="empty" style="margin-top:40px">Failed to load: ${e.message}</div>`
    return
  }

  const mealItems = meals.map(m => `
    <div class="meal-preset-item">
      <div class="meal-preset-icon">${FOOD_PRESET_SVG}</div>
      <div class="meal-preset-body">
        <div class="meal-preset-name">${m.name}</div>
        <div class="meal-preset-meta">P ${fmt(m.protein||0)}g · C ${fmt(m.carbs||0)}g · F ${fmt(m.fat||0)}g${m.meal ? ' · '+cap(m.meal) : ''}</div>
      </div>
      <div class="meal-preset-cal">${round(m.calories)}<span style="font-size:10px;font-weight:400;color:var(--tx3)"> kcal</span></div>
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">⋮</button>
        <div class="entry-menu">
          <button data-action="edit-preset" data-id="${m.id}">Edit</button>
          <button class="danger" data-action="delete-preset" data-id="${m.id}">Delete</button>
        </div>
      </div>
    </div>`).join('')

  const wpItems = wps.map(w => `
    <div class="meal-preset-item">
      <div class="meal-preset-icon">${WORK_PRESET_SVG}</div>
      <div class="meal-preset-body">
        <div class="meal-preset-name">${w.name}</div>
        <div class="meal-preset-meta">${INTENSITY_ICON[w.intensity]||INTENSITY_ICON.medium} ${cap(w.intensity||'medium')}${w.calories_burned ? ' · '+w.calories_burned+' kcal burned' : ''}</div>
      </div>
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">⋮</button>
        <div class="entry-menu">
          <button data-action="edit-workout-preset" data-id="${w.id}">Edit</button>
          <button class="danger" data-action="delete-workout-preset" data-id="${w.id}">Delete</button>
        </div>
      </div>
    </div>`).join('')

  const apiKey = localStorage.getItem('tracker-anthropic-key') || ''

  panel.innerHTML = `<div class="tab-inner">

    ${section('meals', 'Saved Meals', `
      <button class="meals-add-btn" data-action="add-meal-preset">+ Add meal preset</button>
      ${meals.length ? mealItems : '<div class="empty">No saved meals yet.</div>'}
    `, true)}

    ${section('activities', 'Saved Activities', `
      <button class="meals-add-btn" data-action="add-workout-preset">+ Add activity preset</button>
      ${wps.length ? wpItems : '<div class="empty">No saved activities yet.</div>'}
    `)}

    ${section('targets', 'Daily Targets', `
      <p class="setup-note">Changes apply immediately and sync across sessions.</p>
      <div class="targets-grid">
        <div class="form-field">
          <label class="form-label" for="t-cal-rest">Rest day (kcal)</label>
          <input class="form-input" id="t-cal-rest" type="number" inputmode="numeric" value="${TARGETS.calories.rest}">
        </div>
        <div class="form-field">
          <label class="form-label" for="t-cal-training">Training day (kcal)</label>
          <input class="form-input" id="t-cal-training" type="number" inputmode="numeric" value="${TARGETS.calories.training}">
        </div>
        <div class="form-field">
          <label class="form-label" for="t-protein">Protein (g)</label>
          <input class="form-input" id="t-protein" type="number" inputmode="numeric" value="${TARGETS.protein}">
        </div>
        <div class="form-field">
          <label class="form-label" for="t-carbs">Carbs (g)</label>
          <input class="form-input" id="t-carbs" type="number" inputmode="numeric" value="${TARGETS.carbs}">
        </div>
        <div class="form-field">
          <label class="form-label" for="t-fat">Fat (g)</label>
          <input class="form-input" id="t-fat" type="number" inputmode="numeric" value="${TARGETS.fat}">
        </div>
      </div>
      <button class="btn-primary" id="settings-save-targets-btn" style="margin-top:4px">Save Targets</button>
    `)}

    ${section('claude', 'Claude AI', `
      <p class="setup-note">Your API key is stored locally and never sent anywhere except Anthropic's API.</p>
      <div class="form-field">
        <label class="form-label" for="settings-apikey-input">Anthropic API Key</label>
        <input class="form-input" id="settings-apikey-input" type="password"
          placeholder="sk-ant-…" autocomplete="off" value="${apiKey ? '••••••••' : ''}" />
      </div>
      <button class="btn-primary" id="settings-save-apikey-btn" style="margin-top:0">Save Key</button>
    `)}

    ${section('strava', `<span style="display:flex;align-items:center;gap:7px">${STRAVA_S_SVG} Strava</span>`, `
      <div id="strava-disconnected-ui">
        <p class="setup-note">
          Connect your <a href="https://www.strava.com/settings/api" target="_blank">Strava API app</a>.
          Credentials are stored locally on this device only.
        </p>
        <div class="form-field">
          <label class="form-label" for="strava-cid-input">Client ID</label>
          <input class="form-input" id="strava-cid-input" type="text" placeholder="e.g. 12345" autocomplete="off" />
        </div>
        <div class="form-field">
          <label class="form-label" for="strava-csecret-input">Client Secret</label>
          <input class="form-input" id="strava-csecret-input" type="password" placeholder="abc123…" autocomplete="off" />
        </div>
        <button class="btn-strava" id="connect-strava-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 0 18.428h4.172"/></svg>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          Force Sync Now
        </button>
        <button id="remove-strava-btn" class="link-btn" style="margin-top:12px;color:var(--danger);display:block">Remove all synced activities</button>
      </div>
    `)}

    ${section('google', `<span style="display:flex;align-items:center;gap:7px">${GOOGLE_HEALTH_SVG} Google Health</span>`, `
      <div id="gh-disconnected-ui">
        <p class="setup-note">
          Sync activities via the <a href="https://console.cloud.google.com/apis/api/health.googleapis.com/" target="_blank">Google Health API Console</a>.
          Create a Google Cloud project, enable the Google Health API, then create an OAuth 2.0 credential (Web application type) with redirect URI:
          <code style="font-size:11px;background:var(--track);padding:1px 4px;border-radius:4px;word-break:break-all;display:inline-block;max-width:100%">${location.origin + location.pathname}</code>
        </p>
        <div class="form-field">
          <label class="form-label" for="gh-cid-input">Client ID</label>
          <input class="form-input" id="gh-cid-input" type="text" placeholder="123….apps.googleusercontent.com" autocomplete="off" />
        </div>
        <div class="form-field">
          <label class="form-label" for="gh-csecret-input">Client Secret</label>
          <input class="form-input" id="gh-csecret-input" type="password" placeholder="GOCSPX-…" autocomplete="off" />
        </div>
        <button class="btn-google-health" id="connect-gh-btn">
          <svg width="15" height="15" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/></svg>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          Force Sync Now
        </button>
        <button id="remove-gh-btn" class="link-btn" style="margin-top:12px;color:var(--danger);display:block">Remove all Google Health-synced activities</button>
      </div>
    `)}

    ${section('account', 'Account', `
      <p class="setup-note">${state.currentUser.email || state.currentUser.user_metadata?.user_name || 'GitHub user'}</p>
      <button id="settings-signout-btn" style="width:100%;padding:13px;border:1px solid var(--border);border-radius:12px;background:none;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--danger);cursor:pointer;font-weight:500;">Sign out</button>
    `)}

  </div>`

  // Populate Strava + Google Health section state
  updateStravaSettingsSection()
  updateGoogleHealthSettingsSection()

  document.getElementById('settings-save-targets-btn').addEventListener('click', async () => {
    const calRest     = parseInt(document.getElementById('t-cal-rest').value)     || TARGETS.calories.rest
    const calTraining = parseInt(document.getElementById('t-cal-training').value) || TARGETS.calories.training
    const protein     = parseInt(document.getElementById('t-protein').value)      || TARGETS.protein
    const carbs       = parseInt(document.getElementById('t-carbs').value)        || TARGETS.carbs
    const fat         = parseInt(document.getElementById('t-fat').value)          || TARGETS.fat
    TARGETS.calories.rest     = calRest
    TARGETS.calories.training = calTraining
    TARGETS.protein           = protein
    TARGETS.carbs             = carbs
    TARGETS.fat               = fat
    try {
      await db.saveSettings({ cal_rest: calRest, cal_training: calTraining, protein_g: protein, carbs_g: carbs, fat_g: fat })
      showToast('✅ Targets saved')
    } catch (e) { showToast('❌ ' + e.message) }
  })

  document.getElementById('settings-save-apikey-btn').addEventListener('click', () => {
    const inp = document.getElementById('settings-apikey-input')
    const key = inp.value.trim()
    if (!key || key.startsWith('•')) return
    localStorage.setItem('tracker-anthropic-key', key)
    inp.value = '••••••••'
    showToast('✅ API key saved')
  })

  document.getElementById('connect-strava-btn').addEventListener('click', connectStrava)

  document.getElementById('disconnect-strava-btn')?.addEventListener('click', disconnectStrava)

  document.getElementById('force-sync-btn')?.addEventListener('click', async () => {
    closeSheets()
    await syncStrava({ silent: false })
  })

  document.getElementById('remove-strava-btn')?.addEventListener('click', async () => {
    if (!confirm('Remove all Strava-synced activities from the tracker? They will re-sync on next load.')) return
    try {
      await db.deleteStravaWorkouts()
      showToast('🗑️ Strava activities removed')
      closeSheets()
    } catch (e) { showToast('❌ ' + e.message) }
  })

  document.getElementById('connect-gh-btn').addEventListener('click', connectGoogleHealth)

  document.getElementById('disconnect-gh-btn')?.addEventListener('click', disconnectGoogleHealth)

  document.getElementById('gh-force-sync-btn')?.addEventListener('click', async () => {
    closeSheets()
    await syncGoogleHealth({ silent: false })
  })

  document.getElementById('remove-gh-btn')?.addEventListener('click', async () => {
    if (!confirm('Remove all Google Health-synced activities from the tracker? They will re-sync on next load.')) return
    try {
      await db.deleteGoogleHealthWorkouts()
      showToast('🗑️ Google Health activities removed')
      closeSheets()
    } catch (e) { showToast('❌ ' + e.message) }
  })

  document.getElementById('settings-signout-btn').addEventListener('click', async () => {
    if (!confirm('Sign out?')) return
    closeSheets()
    await supabase.auth.signOut()
  })
}

export function openPresetSheet(id) {
  state.pendingEditPresetId = id
  const m = id ? (state.mealsCache || []).find(x => x.id === id) : null
  document.getElementById('meal-preset-title').textContent = m ? 'Edit Meal' : 'New Meal'
  document.getElementById('mp-name').value = m?.name || ''
  document.getElementById('mp-cal').value  = m?.calories || ''
  document.getElementById('mp-pro').value  = m?.protein  || ''
  document.getElementById('mp-car').value  = m?.carbs    || ''
  document.getElementById('mp-fat').value  = m?.fat      || ''
  document.querySelectorAll('#mp-meal-btns .meal-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.meal === (m?.meal || 'snack')))
  document.getElementById('save-preset-btn').textContent = m ? 'Update Meal' : 'Save Meal'
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
  state.pendingEditWorkoutPresetId = id
  const w = id ? (state.workoutPresetsCache || []).find(x => x.id === id) : null
  document.getElementById('wps-title').textContent = w ? 'Edit Activity' : 'New Activity'
  document.getElementById('wps-name').value = w?.name || ''
  document.getElementById('wps-calories-burned').value = w?.calories_burned || ''
  document.querySelectorAll('#wps-intensity-btns .intensity-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.intensity === (w?.intensity || 'medium')))
  document.getElementById('save-wps-btn').textContent = w ? 'Update Activity' : 'Save Activity'
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

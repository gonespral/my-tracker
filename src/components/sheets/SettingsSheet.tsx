import { useEffect, useState, type ReactNode } from 'react'
import { useAppStore } from '../../store'
import { closeSheet, openIntegrationsSheet, openApiKeySheet, openMealPresetSheet, openWorkoutPresetSheet } from '../../lib/sheets'
import { db, supabase, isDemo } from '../../lib/db'
import { showToast } from '../../lib/toast'
import { fmt, round, cap } from '../../lib/utils'
import { INTENSITY_ICON_NAME } from '../../lib/config'
import EntryMenu from '../EntryMenu'
import { openTutorial } from '../Tutorial'
import {
  TARGETS, CALORIE_SEX, CALORIE_ACTIVITY_LEVELS, CALORIE_PROFILE_DEFAULTS,
  computeCalorieTargets, setCalorieDeficit, type CalorieProfile,
} from '../../lib/config'
import { googleHealthIsConnected, calibrateTDEETargets } from '../../lib/google-health'
import Sheet from '../Sheet'
import Icon from '../Icon'

function withDeficit(rest: number, deficitKcal: number) {
  const deficit = Math.max(0, Number(deficitKcal) || 0)
  return Math.max(0, Math.round(rest - deficit))
}

function SettingsSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`settings-section${open ? ' open' : ''}`}>
      <button type="button" className="settings-section-header" onClick={onToggle}>
        <span className="settings-section-title">{title}</span>
        <Icon name="expand_more" size={16} className="settings-section-chevron" />
      </button>
      <div className="settings-section-body-wrap">
        <div className="settings-section-body">
          <div className="settings-section-body-inner">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsSheet() {
  const open = useAppStore((s) => s.openSheetId === 'settings')
  const currentUser = useAppStore((s) => s.currentUser)
  const dbCache = useAppStore((s) => s.dbCache)
  const latestWeightKg = dbCache?.weights?.[0]?.kg ?? null
  const mealsCache = useAppStore((s) => s.mealsCache)
  const workoutPresetsCache = useAppStore((s) => s.workoutPresetsCache)

  // Caches are nulled whenever a preset is added/edited/deleted (here or by
  // Claude); reload while the sheet is open so the lists stay current.
  useEffect(() => {
    if (!open || mealsCache) return
    db.loadMeals().then((m) => useAppStore.setState({ mealsCache: m })).catch(() => {})
  }, [open, mealsCache])
  useEffect(() => {
    if (!open || workoutPresetsCache) return
    db.loadWorkoutPresets().then((w) => useAppStore.setState({ workoutPresetsCache: w })).catch(() => {})
  }, [open, workoutPresetsCache])

  async function handleDeleteMealPreset(id: string) {
    try {
      await db.deleteMeal(id)
      useAppStore.setState({ mealsCache: null })
      showToast('Meal deleted')
    } catch (e) { showToast((e as Error).message) }
  }

  async function handleDeleteWorkoutPreset(id: string) {
    try {
      await db.deleteWorkoutPreset(id)
      useAppStore.setState({ workoutPresetsCache: null })
      showToast('Activity preset deleted')
    } catch (e) { showToast((e as Error).message) }
  }

  const [openSection, setOpenSection] = useState('')
  function toggleSection(key: string) {
    setOpenSection((prev) => (prev === key ? '' : key))
  }

  // Start with every section collapsed each time the sheet opens
  useEffect(() => {
    if (open) setOpenSection('')
  }, [open])

  const [useBmr, setUseBmr] = useState(true)
  const [useGHCalibration, setUseGHCalibration] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [calRestInput, setCalRestInput] = useState(String(TARGETS.calories.rest))
  const [eatbackEnabled, setEatbackEnabled] = useState(true)
  const [eatbackPct, setEatbackPct] = useState(TARGETS.calories.eatback_pct)

  const [profileAge, setProfileAge] = useState('')
  const [profileSex, setProfileSex] = useState<keyof typeof CALORIE_SEX>(CALORIE_PROFILE_DEFAULTS.sex as keyof typeof CALORIE_SEX)
  const [profileHeight, setProfileHeight] = useState('')
  const [profileWeight, setProfileWeight] = useState('')
  const [profileActivity, setProfileActivity] = useState<keyof typeof CALORIE_ACTIVITY_LEVELS>(CALORIE_PROFILE_DEFAULTS.activity_level as keyof typeof CALORIE_ACTIVITY_LEVELS)
  const [deficitInput, setDeficitInput] = useState('0')

  const [macroMode, setMacroMode] = useState<'g' | 'pct'>(() => (localStorage.getItem('tracker-macro-mode') as 'g' | 'pct') || 'g')
  const [proteinInput, setProteinInput] = useState(String(TARGETS.protein))
  const [carbsInput, setCarbsInput] = useState(String(TARGETS.carbs))
  const [fatInput, setFatInput] = useState(String(TARGETS.fat))
  const [proteinPerKgInput, setProteinPerKgInput] = useState('')

  const [usdaKey, setUsdaKey] = useState('')

  useEffect(() => {
    if (!open) return
    const settings = useAppStore.getState().settings as Record<string, unknown>

    const ghCalib = settings.tdee_source === 'google-health'
    setUseGHCalibration(ghCalib)
    setUseBmr(!ghCalib && (settings.use_bmr_target != null ? !!settings.use_bmr_target : true))
    setCalRestInput(String(TARGETS.calories.rest))
    setEatbackEnabled((settings.eatback_enabled as boolean) ?? true)
    setEatbackPct((settings.eatback_pct as number) ?? TARGETS.calories.eatback_pct)
    setDeficitInput(String((settings.bmr_deficit as number) ?? TARGETS.calories.deficit ?? 0))

    setProfileAge(String(settings.age_years ?? ''))
    setProfileSex((CALORIE_SEX[settings.sex as keyof typeof CALORIE_SEX] ? settings.sex : CALORIE_PROFILE_DEFAULTS.sex) as keyof typeof CALORIE_SEX)
    setProfileHeight(String(settings.height_cm ?? ''))
    setProfileWeight(String(settings.weight_kg ?? latestWeightKg ?? ''))
    setProfileActivity((CALORIE_ACTIVITY_LEVELS[settings.activity_level as keyof typeof CALORIE_ACTIVITY_LEVELS] ? settings.activity_level : CALORIE_PROFILE_DEFAULTS.activity_level) as keyof typeof CALORIE_ACTIVITY_LEVELS)

    const mode = (localStorage.getItem('tracker-macro-mode') as 'g' | 'pct') || 'g'
    setMacroMode(mode)
    const calGoal = TARGETS.calories.goal || TARGETS.calories.rest
    if (mode === 'pct' && calGoal > 0) {
      setProteinInput(String(Math.round(TARGETS.protein * 4 / calGoal * 100)))
      setCarbsInput(String(Math.round(TARGETS.carbs * 4 / calGoal * 100)))
      setFatInput(String(Math.round(TARGETS.fat * 9 / calGoal * 100)))
    } else {
      setProteinInput(String(TARGETS.protein))
      setCarbsInput(String(TARGETS.carbs))
      setFatInput(String(TARGETS.fat))
    }
    setProteinPerKgInput(settings.protein_per_kg != null ? String(settings.protein_per_kg) : '')

    setUsdaKey(localStorage.getItem('tracker-fdc-api-key') ? '••••••••' : '')
  }, [open, latestWeightKg])

  const profileForEstimate: CalorieProfile = {
    age: profileAge, sex: profileSex, height_cm: profileHeight,
    weight_kg: profileWeight || latestWeightKg || '', activity_level: profileActivity,
  }
  const estimatedProfile = computeCalorieTargets(profileForEstimate, latestWeightKg)
  const deficitNow = Math.max(0, parseInt(deficitInput, 10) || 0)

  function applyEstimatedToTargets() {
    if (!estimatedProfile) return
    TARGETS.calories.rest = estimatedProfile.rest
    TARGETS.calories.bmr = estimatedProfile.bmr
    const goal = setCalorieDeficit(deficitNow)
    TARGETS.calories.training = goal
    setCalRestInput(String(estimatedProfile.rest))
  }

  async function handleToggleUseBmr(checked: boolean) {
    setUseBmr(checked)
    if (checked && useGHCalibration) {
      setUseGHCalibration(false)
      await db.saveSettings({ tdee_source: null, tdee_calibrated_at: null }).catch(() => {})
    }
    await db.saveSettings({ use_bmr_target: checked }).catch(() => {})
    if (checked) {
      applyEstimatedToTargets()
      if (eatbackEnabled) {
        setProfileActivity('sedentary')
        await db.saveSettings({ activity_level: 'sedentary' }).catch(() => {})
      }
    }
    db.bust()
  }

  async function handleToggleGH(checked: boolean) {
    setUseGHCalibration(checked)
    if (checked) {
      setUseBmr(false)
      await db.saveSettings({ use_bmr_target: false, tdee_source: 'google-health' }).catch(() => {})
    } else {
      await db.saveSettings({ tdee_source: null, tdee_calibrated_at: null }).catch(() => {})
    }
    db.bust()
  }

  async function handleCalibrateNow() {
    setCalibrating(true)
    await calibrateTDEETargets({ silent: false })
    setCalibrating(false)
    setCalRestInput(String(TARGETS.calories.rest))
    db.bust()
  }

  async function handleSaveTargets() {
    const calRest = parseInt(calRestInput, 10) || TARGETS.calories.rest
    TARGETS.calories.rest = calRest
    try {
      await db.saveSettings({ cal_rest: calRest })
      showToast('Calorie target saved')
      db.bust()
    } catch (e) { showToast((e as Error).message) }
  }

  async function handleSaveProfile() {
    const resolvedWeight = profileWeight || latestWeightKg || ''
    const estimated = computeCalorieTargets({ ...profileForEstimate, weight_kg: resolvedWeight }, latestWeightKg)
    if (!estimated) { showToast('Enter age, height, and weight to calculate TDEE'); return }
    TARGETS.calories.rest = estimated.rest
    TARGETS.calories.bmr = estimated.bmr
    const goal = setCalorieDeficit(deficitNow)
    TARGETS.calories.training = goal
    setCalRestInput(String(estimated.rest))
    try {
      await db.saveSettings({
        cal_rest: TARGETS.calories.rest,
        cal_training: TARGETS.calories.training,
        age_years: profileAge, sex: profileSex, height_cm: profileHeight, weight_kg: resolvedWeight,
        activity_level: profileActivity, bmr_deficit: deficitNow, use_bmr_target: useBmr,
      })
      showToast('Profile saved')
      db.bust()
    } catch (e) { showToast((e as Error).message) }
  }

  function handleEatbackToggle(checked: boolean) {
    setEatbackEnabled(checked)
    TARGETS.calories.eatback_enabled = checked
    db.saveSettings({ eatback_enabled: checked }).catch(() => {})
    if (useBmr) {
      if (checked) {
        setProfileActivity('sedentary')
        db.saveSettings({ activity_level: 'sedentary' }).catch(() => {})
      }
    }
    db.bust()
  }

  function handleEatbackSlider(pct: number) {
    setEatbackPct(pct)
    TARGETS.calories.eatback_pct = pct
    db.saveSettings({ eatback_pct: pct }).catch(() => {})
    db.bust()
  }

  function handleMacroModeChange(newMode: 'g' | 'pct') {
    if (newMode === macroMode) return
    const cal = TARGETS.calories.goal || TARGETS.calories.rest
    if (newMode === 'pct' && cal > 0) {
      setProteinInput(String(Math.round((parseInt(proteinInput, 10) || TARGETS.protein) * 4 / cal * 100)))
      setCarbsInput(String(Math.round((parseInt(carbsInput, 10) || TARGETS.carbs) * 4 / cal * 100)))
      setFatInput(String(Math.round((parseInt(fatInput, 10) || TARGETS.fat) * 9 / cal * 100)))
    } else if (newMode === 'g' && cal > 0) {
      setProteinInput(String(Math.round(cal * (parseInt(proteinInput, 10) || 20) / 100 / 4)))
      setCarbsInput(String(Math.round(cal * (parseInt(carbsInput, 10) || 45) / 100 / 4)))
      setFatInput(String(Math.round(cal * (parseInt(fatInput, 10) || 35) / 100 / 9)))
    }
    localStorage.setItem('tracker-macro-mode', newMode)
    setMacroMode(newMode)
  }

  const weightForPerKg = parseFloat(profileWeight) || latestWeightKg || null
  const perKgVal = parseFloat(proteinPerKgInput)
  const perKgComputed = perKgVal > 0 && weightForPerKg ? Math.round(perKgVal * weightForPerKg) : null

  const macroCalGoal = TARGETS.calories.goal || TARGETS.calories.rest
  const pctTotal = macroMode === 'pct' ? (parseInt(proteinInput, 10) || 0) + (parseInt(carbsInput, 10) || 0) + (parseInt(fatInput, 10) || 0) : null

  async function handleSaveMacros() {
    const cal = TARGETS.calories.goal || TARGETS.calories.rest
    const perKgRaw = parseFloat(proteinPerKgInput)
    const proteinPerKg = perKgRaw > 0 ? perKgRaw : null
    const weightKgForSave = parseFloat(profileWeight) || latestWeightKg || null

    let protein: number, carbs: number, fat: number
    if (macroMode === 'pct') {
      const pp = parseInt(proteinInput, 10) || 0
      const cp = parseInt(carbsInput, 10) || 0
      const fp = parseInt(fatInput, 10) || 0
      protein = proteinPerKg && weightKgForSave ? Math.round(proteinPerKg * weightKgForSave) : Math.round(cal * pp / 100 / 4)
      carbs = Math.round(cal * cp / 100 / 4)
      fat = Math.round(cal * fp / 100 / 9)
    } else {
      protein = parseInt(proteinInput, 10) || TARGETS.protein
      carbs = parseInt(carbsInput, 10) || TARGETS.carbs
      fat = parseInt(fatInput, 10) || TARGETS.fat
      if (proteinPerKg && weightKgForSave) protein = Math.round(proteinPerKg * weightKgForSave)
    }

    TARGETS.protein = protein
    TARGETS.carbs = carbs
    TARGETS.fat = fat
    TARGETS.protein_per_kg = proteinPerKg

    try {
      await db.saveSettings({ protein_g: protein, carbs_g: carbs, fat_g: fat, protein_per_kg: proteinPerKg })
      showToast('Macros saved')
      db.bust()
    } catch (e) { showToast((e as Error).message) }
  }

  function handleSaveUsdaKey() {
    const trimmed = usdaKey.trim()
    if (!trimmed || trimmed.startsWith('•')) return
    localStorage.setItem('tracker-fdc-api-key', trimmed)
    setUsdaKey('••••••••')
    showToast('USDA key saved')
  }

  async function handleSignOut() {
    if (!confirm('Sign out?')) return
    closeSheet()
    await supabase.auth.signOut()
  }

  async function handleForceUpdate() {
    showToast('Updating…')
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch { /* ignore */ }
    // Cache-busting query so index.html itself is refetched from the network
    // (a plain reload() may serve it from HTTP cache even after SW unregister)
    location.replace(location.pathname + '?upd=' + Date.now())
  }

  async function handleDisableDemo() {
    if (!confirm('Exit demo mode?')) return
    await supabase.auth.signOut()
  }

  const summaryText = estimatedProfile
    ? (() => {
        const sexLabel = CALORIE_SEX[estimatedProfile.sex]?.label || 'Other'
        const activity = CALORIE_ACTIVITY_LEVELS[estimatedProfile.activity_level]?.label || 'Moderate'
        const weightLabel = Number.isFinite(estimatedProfile.weight_kg) ? `${estimatedProfile.weight_kg.toFixed(estimatedProfile.weight_kg % 1 ? 2 : 0)} kg` : 'n/a'
        const usedLatest = latestWeightKg != null && estimatedProfile.weight_kg === latestWeightKg
        if (!deficitNow) {
          return `${estimatedProfile.rest.toLocaleString()} kcal/day estimated target. BMR helper: ${estimatedProfile.bmr.toLocaleString()} kcal · ${sexLabel} · ${estimatedProfile.age} years · ${estimatedProfile.height_cm} cm · ${weightLabel} · ${activity}${usedLatest ? ` · using latest logged weight (${latestWeightKg!.toFixed(2)} kg)` : ''}.`
        }
        const adjusted = withDeficit(estimatedProfile.rest, deficitNow)
        return `${adjusted.toLocaleString()} kcal/day target after deficit. Maintenance: ${estimatedProfile.rest.toLocaleString()} kcal · Deficit: ${deficitNow.toLocaleString()} kcal · BMR helper: ${estimatedProfile.bmr.toLocaleString()} kcal · ${sexLabel} · ${estimatedProfile.age} years · ${estimatedProfile.height_cm} cm · ${weightLabel} · ${activity}${usedLatest ? ` · using latest logged weight (${latestWeightKg!.toFixed(2)} kg)` : ''}.`
      })()
    : 'Add age, sex, height, weight, and activity level to estimate your baseline calorie burn.'

  const userEmail = (currentUser as { email?: string; user_metadata?: Record<string, unknown> } | null)?.email
    || ((currentUser as { user_metadata?: Record<string, unknown> } | null)?.user_metadata?.user_name as string | undefined)
    || 'GitHub user'

  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'
  const commitIso = import.meta.env.VITE_COMMIT_TIME || __BUILD_TIME__
  const commitLabel = (() => {
    try {
      return new Date(commitIso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
    } catch {
      return commitIso
    }
  })()

  return (
    <Sheet
      open={open}
      title="Settings"
      titleBadge={isDemo ? (
        <span className="settings-version settings-version-demo" data-tip="Tap to exit demo mode" aria-label="Demo mode" onClick={handleDisableDemo}>
          Demo
        </span>
      ) : undefined}
    >
      <SettingsSection title="Presets" open={openSection === 'presets'} onToggle={() => toggleSection('presets')}>
        <div className="section-label">Meals</div>
        <button className="meals-add-btn" onClick={() => openMealPresetSheet(null)}>+ Add meal preset</button>
        {mealsCache?.length ? mealsCache.map((m) => (
          <div className="meal-preset-item" key={m.id}>
            <div className="meal-preset-icon"><Icon name="restaurant" size={15} /></div>
            <div className="meal-preset-body">
              <div className="meal-preset-name">{m.name}</div>
              <div className="meal-preset-meta">P {fmt(m.protein || 0)}g · C {fmt(m.carbs || 0)}g · F {fmt(m.fat || 0)}g{m.meal ? ' · ' + cap(m.meal) : ''}</div>
            </div>
            <div className="meal-preset-cal">{round(m.calories)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--tx3)' }}> kcal</span></div>
            <EntryMenu>
              <button onClick={() => openMealPresetSheet(m)}>Edit</button>
              <button className="danger" onClick={() => handleDeleteMealPreset(m.id)}>Delete</button>
            </EntryMenu>
          </div>
        )) : <div className="empty">No saved meals yet.</div>}

        <div className="settings-section-divider" />

        <div className="section-label">Activities</div>
        <button className="meals-add-btn" onClick={() => openWorkoutPresetSheet(null)}>+ Add activity preset</button>
        {workoutPresetsCache?.length ? workoutPresetsCache.map((w) => (
          <div className="meal-preset-item" key={w.id}>
            <div className="meal-preset-icon"><Icon name="fitness_center" size={15} /></div>
            <div className="meal-preset-body">
              <div className="meal-preset-name">{w.name}</div>
              <div className="meal-preset-meta">
                <Icon {...(INTENSITY_ICON_NAME[w.intensity || 'medium'] || INTENSITY_ICON_NAME.medium)} size={12} style={{ verticalAlign: '-2px' }} />
                {' '}{cap(w.intensity || 'medium')}{w.calories_burned ? ` · ${w.calories_burned} kcal burned` : ''}
              </div>
            </div>
            <EntryMenu>
              <button onClick={() => openWorkoutPresetSheet(w)}>Edit</button>
              <button className="danger" onClick={() => handleDeleteWorkoutPreset(w.id)}>Delete</button>
            </EntryMenu>
          </div>
        )) : <div className="empty">No saved activities yet.</div>}
      </SettingsSection>

      <SettingsSection title="Calories" open={openSection === 'calories'} onToggle={() => toggleSection('calories')}>
        <div className="toggle-row" style={{ marginBottom: 8 }}>
          <div className="toggle-row-label">Profile-based target</div>
          <label className="toggle-switch">
            <input type="checkbox" checked={useBmr} onChange={(e) => handleToggleUseBmr(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="toggle-row" style={{ marginBottom: 8 }}>
          <div>
            <div className="toggle-row-label">Activity eat-back</div>
            <div className="toggle-row-sub">Add a portion of logged workout calories back to your daily target.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={eatbackEnabled} onChange={(e) => handleEatbackToggle(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        {eatbackEnabled && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="form-input" type="number" inputMode="numeric" min={0} max={100} step={5} value={eatbackPct}
                style={{ width: 70 }} onChange={(e) => handleEatbackSlider(Number(e.target.value))} />
              <span style={{ fontSize: 14, color: 'var(--tx)' }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>50% recommended. Device burn estimates are often 20-40% too high.</div>
          </div>
        )}
        {googleHealthIsConnected() && (
          <div className="toggle-row" style={{ marginBottom: 8 }}>
            <div>
              <div className="toggle-row-label">Calibrate from Google Health</div>
              <div className="toggle-row-sub">Use measured target instead of the profile estimate</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={useGHCalibration} onChange={(e) => handleToggleGH(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        )}

        <div className="form-field" style={{ marginBottom: 14 }}>
          <label className="form-label">Target (kcal)</label>
          <input className="form-input" type="number" inputMode="numeric" style={{ maxWidth: 160 }}
            value={useBmr
              ? String(Math.round(estimatedProfile
                  ? withDeficit(estimatedProfile.rest, deficitNow)
                  : (TARGETS.calories.goal || TARGETS.calories.rest)))
              : calRestInput}
            disabled={useBmr || useGHCalibration} onChange={(e) => setCalRestInput(e.target.value)} />
        </div>
        {!useBmr && !useGHCalibration && <button className="btn-integration" onClick={handleSaveTargets}>Save</button>}
        {useGHCalibration && (
          <button className="btn-integration" onClick={handleCalibrateNow} disabled={calibrating}>
            <Icon name="monitor_heart" size={14} style={{ verticalAlign: '-2px', flexShrink: 0 }} /> {calibrating ? 'Calibrating…' : 'Calibrate Now'}
          </button>
        )}

        {useBmr && (
          <div style={{ marginTop: 6 }}>
            <div className="settings-profile-summary" style={{ marginTop: 6 }}>{summaryText}</div>
            <div className="profile-grid">
              <div className="form-field">
                <label className="form-label">Age (years)</label>
                <input className="form-input" type="number" inputMode="numeric" min={13} max={120} value={profileAge}
                  onChange={(e) => { setProfileAge(e.target.value); }} onBlur={applyEstimatedToTargets} />
              </div>
              <div className="form-field">
                <label className="form-label">Sex</label>
                <select className="form-input" value={profileSex} onChange={(e) => { setProfileSex(e.target.value as keyof typeof CALORIE_SEX); }}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Height (cm)</label>
                <input className="form-input" type="number" inputMode="numeric" min={100} max={250} value={profileHeight}
                  onChange={(e) => setProfileHeight(e.target.value)} onBlur={applyEstimatedToTargets} />
              </div>
              <div className="form-field">
                <label className="form-label">Weight (kg)</label>
                <input className="form-input" type="number" inputMode="decimal" min={25} max={300} step={0.1} value={profileWeight}
                  onChange={(e) => setProfileWeight(e.target.value)} onBlur={applyEstimatedToTargets} />
              </div>
              <div className="form-field">
                <label className="form-label">Daily movement</label>
                <select className="form-input" value={profileActivity} disabled={useBmr && eatbackEnabled} style={useBmr && eatbackEnabled ? { opacity: 0.4 } : undefined}
                  onChange={(e) => { setProfileActivity(e.target.value as keyof typeof CALORIE_ACTIVITY_LEVELS); }}>
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="active">Active</option>
                  <option value="very_active">Very active</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Deficit (kcal/day)</label>
                <input className="form-input" type="number" inputMode="numeric" min={0} max={1500} step={10} value={deficitInput}
                  onChange={(e) => { setDeficitInput(e.target.value); applyEstimatedToTargets() }} />
              </div>
            </div>
            <p className="settings-profile-note">This estimate includes everyday movement, so it behaves like a daily TDEE rather than workout-only calories.</p>
            <button className="btn-integration" style={{ marginTop: 4 }} onClick={handleSaveProfile}>Save Profile</button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Macros" open={openSection === 'macros'} onToggle={() => toggleSection('macros')}>
        <div className="macro-mode-bar">
          <div className="macro-mode-switcher">
            <button type="button" className={`mode-seg ${macroMode === 'g' ? 'active' : ''}`} onClick={() => handleMacroModeChange('g')}>g</button>
            <button type="button" className={`mode-seg ${macroMode === 'pct' ? 'active' : ''}`} onClick={() => handleMacroModeChange('pct')}>%</button>
          </div>
        </div>

        <div className="macros-boxes-grid">
          <div className="macro-box">
            <div className="macro-box-label">Protein</div>
            <div className="macro-box-input-wrap">
              <input className="macro-box-input" type="number" inputMode="decimal" value={proteinInput} readOnly={!!perKgComputed}
                onChange={(e) => setProteinInput(e.target.value)} />
              <span className="macro-box-unit">{macroMode === 'g' ? 'g' : '%'}</span>
            </div>
            <div className="macro-box-hint">
              {macroMode === 'pct' && macroCalGoal > 0 ? `= ${Math.round(macroCalGoal * (parseInt(proteinInput, 10) || 0) / 100 / 4)}g` : (perKgComputed ? 'from g/kg' : '')}
            </div>
            <div className="macro-box-perkg">
              <input className="macro-perkg-input" type="number" inputMode="decimal" step={0.1} min={0.5} max={4} placeholder="g / kg body weight"
                value={proteinPerKgInput} onChange={(e) => setProteinPerKgInput(e.target.value)} />
              <div className="macro-box-hint">{perKgComputed ? `= ${perKgComputed}g at ${weightForPerKg!.toFixed(1)}kg` : ''}</div>
            </div>
          </div>

          <div className="macro-box">
            <div className="macro-box-label">Carbs</div>
            <div className="macro-box-input-wrap">
              <input className="macro-box-input" type="number" inputMode="decimal" value={carbsInput} onChange={(e) => setCarbsInput(e.target.value)} />
              <span className="macro-box-unit">{macroMode === 'g' ? 'g' : '%'}</span>
            </div>
            <div className="macro-box-hint">{macroMode === 'pct' && macroCalGoal > 0 ? `= ${Math.round(macroCalGoal * (parseInt(carbsInput, 10) || 0) / 100 / 4)}g` : ''}</div>
          </div>

          <div className="macro-box">
            <div className="macro-box-label">Fat</div>
            <div className="macro-box-input-wrap">
              <input className="macro-box-input" type="number" inputMode="decimal" value={fatInput} onChange={(e) => setFatInput(e.target.value)} />
              <span className="macro-box-unit">{macroMode === 'g' ? 'g' : '%'}</span>
            </div>
            <div className="macro-box-hint">{macroMode === 'pct' && macroCalGoal > 0 ? `= ${Math.round(macroCalGoal * (parseInt(fatInput, 10) || 0) / 100 / 9)}g` : ''}</div>
          </div>
        </div>

        {macroMode === 'pct' && pctTotal != null && (
          <div className={`macro-pct-total ${pctTotal === 100 ? 'exact' : pctTotal > 100 ? 'over' : ''}`}>
            Total: {pctTotal}%{pctTotal !== 100 ? ` (${pctTotal > 100 ? '+' : ''}${pctTotal - 100}%)` : ' ✓'}
          </div>
        )}

        <button className="btn-integration" onClick={handleSaveMacros}>Save Macros</button>
      </SettingsSection>

      <SettingsSection title="Integrations & API Keys" open={openSection === 'integrations'} onToggle={() => toggleSection('integrations')}>
        <div className="integration-label"><Icon name="smart_toy" size={16} /> Sonnet 4.6 API</div>
        <p className="setup-note">Your API key is stored locally and never sent anywhere except Anthropic's API.</p>
        <button className="btn-integration" onClick={openApiKeySheet}>Manage Anthropic API Key</button>

        <div className="settings-section-divider" />

        <div className="integration-label"><Icon name="database" size={16} /> Food Database</div>
        <p className="setup-note">
          Claude looks up real nutrition data (USDA FoodData Central + Open Food Facts) before estimating calories.
          Works out of the box with no setup. Only needed if you hit rate limits: <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noopener">get a free USDA key</a>.
        </p>
        <div className="form-field">
          <label className="form-label">USDA API Key (optional)</label>
          <input className="form-input" type="password" placeholder="DEMO_KEY" autoComplete="off" value={usdaKey} onChange={(e) => setUsdaKey(e.target.value)} />
        </div>
        <button className="btn-integration" onClick={handleSaveUsdaKey}>Save Key</button>

        <div className="settings-section-divider" />

        <div className="integration-label"><Icon name="directions_run" size={16} /> Strava &amp; Google Health</div>
        <p className="setup-note">Connect/disconnect, force-sync, auto-push, and conflict preference settings.</p>
        <button className="btn-integration" onClick={openIntegrationsSheet}>Manage Integrations</button>
      </SettingsSection>

      <SettingsSection title="Account" open={openSection === 'account'} onToggle={() => toggleSection('account')}>
        <p className="setup-note">Signed in as {userEmail} via Supabase Auth. Your data is stored securely in a private Supabase database and synced across devices.</p>
        <button className="btn-integration" style={{ marginTop: 16 }} onClick={() => { closeSheet(); openTutorial() }}>Show tutorial again</button>
        <button className="btn-integration" style={{ marginTop: 10, color: 'var(--danger)' }} onClick={handleSignOut}>Sign out</button>
      </SettingsSection>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32, marginBottom: 16, gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.7, textAlign: 'center' }}>
          Made by <strong style={{ color: 'var(--tx2)' }}>Gonçalo Nespral</strong><br />
          <a href="https://github.com/gonespral/my-tracker" target="_blank" rel="noopener" style={{ color: 'var(--tx2)', textDecoration: 'none' }}>GitHub repo</a>
        </div>
        <a href="help/" target="_blank" rel="noopener" className="settings-docs-btn" title="Documentation">
          <Icon name="menu_book" size={15} />
          Docs
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
          <span
            className="settings-version"
            data-tip="Tap to force update"
            aria-label="App version"
            style={{ cursor: 'pointer' }}
            onClick={handleForceUpdate}
          >
            {appVersion}
          </span>
          <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{commitLabel}</span>
        </div>
      </div>
    </Sheet>
  )
}

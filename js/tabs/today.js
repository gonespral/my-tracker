import { TARGETS, MEAL_ORDER, MEAL_LABEL, MEAL_ICON, CREATINE_COLOR } from '../config.js'
import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr, sumFood, calculateNetActiveCalories, calculateTotalActivityCalories, fmtDateShort } from '../utils.js'
import { stagger, renderPanel } from '../animate.js'
import { calRingHTML, macroRingHTML, weekChartHTML, streakHTML, sparklineHTML, MACRO_COLORS } from '../charts.js'
import { getCalorieGoal } from '../config.js'
import { foodItem, workoutItem, groupWorkoutsByConflict, workoutStack, supplementItem, isSavedMealEntry } from '../renderers.js'
import { openSheet, showToast, closeMenus } from '../ui.js'
import { fetchDailyWisdom } from '../ai.js'
import { materialIcon } from '../icons.js'

const MEAL_TIME_ORDER = ['breakfast', 'lunch', 'snack', 'dinner']

// Fraction of the eating window (7 am–10 pm) at which each meal is expected to be done.
const MEAL_POS = { breakfast: 0.133, lunch: 0.4, snack: 0.6, dinner: 0.867 }

function timeOfDayFrac() {
  const EATING_START = 7, EATING_END = 22
  const now = new Date()
  const t = now.getHours() + now.getMinutes() / 60
  if (t <= EATING_START) return 0
  if (t >= EATING_END)   return 1
  return (t - EATING_START) / (EATING_END - EATING_START)
}

// Returns expected-cals-consumed-by-now / effectiveTarget based on 30-day meal history
// and the current time of day. Values >1 signal overflow (target already exceeded by pace).
// Returns 0 before 7 am (ticker hidden).
function computeMealFrac(data, effectiveTarget) {
  const t = timeOfDayFrac()
  if (t <= 0) return 0

  const sums     = Object.fromEntries(MEAL_TIME_ORDER.map(m => [m, 0]))
  const daysSeen = Object.fromEntries(MEAL_TIME_ORDER.map(m => [m, 0]))
  for (let i = 1; i <= 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dayMealCals = {}
    for (const e of (data.food[dateStr(d)] || [])) {
      if (e.meal && e.meal in sums)
        dayMealCals[e.meal] = (dayMealCals[e.meal] || 0) + (e.calories || 0)
    }
    for (const m of MEAL_TIME_ORDER) {
      if (m in dayMealCals) { sums[m] += dayMealCals[m]; daysSeen[m]++ }
    }
  }

  const totalDays = Object.values(daysSeen).reduce((s, c) => s + c, 0)
  // No history or no target: fall back to raw time-of-day fraction
  if (totalDays === 0 || effectiveTarget <= 0) return t

  // Per-meal average; unknown meals default to the mean of known ones
  const knownAvgs = MEAL_TIME_ORDER.map(m => daysSeen[m] > 0 ? sums[m] / daysSeen[m] : null)
  const knownVals = knownAvgs.filter(v => v !== null)
  const fallback  = knownVals.length > 0 ? knownVals.reduce((s, v) => s + v, 0) / knownVals.length : 0
  const avgs      = Object.fromEntries(MEAL_TIME_ORDER.map((m, i) => [m, knownAvgs[i] ?? fallback]))

  // Sum expected calories, interpolating through each meal's time window
  let expected = 0
  for (let i = 0; i < MEAL_TIME_ORDER.length; i++) {
    const m       = MEAL_TIME_ORDER[i]
    const pos     = MEAL_POS[m]
    const prevPos = i > 0 ? MEAL_POS[MEAL_TIME_ORDER[i - 1]] : 0
    if (t >= pos) {
      expected += avgs[m]
    } else if (t > prevPos) {
      expected += avgs[m] * (t - prevPos) / (pos - prevPos)
    }
  }

  return expected / effectiveTarget
}

function wisdomHeader() {
  return `<div class="wisdom-header"><div class="wisdom-title">Claude Wisdom</div><button class="wisdom-reload-btn" data-action="reload-wisdom" aria-label="Regenerate"><span class="material-symbols-outlined" style="font-size:14px">refresh</span></button></div>`
}

function loadWisdom(wisdomEl) {
  wisdomEl.innerHTML = `${wisdomHeader()}<div class="wisdom-text wisdom-loading">Loading...</div>`
  fetchDailyWisdom().then(text => {
    if (text) {
      wisdomEl.innerHTML = `${wisdomHeader()}<div class="wisdom-text">${text}</div>`
      wisdomEl.dataset.loaded = '1'
    } else {
      wisdomEl.innerHTML = ''
    }
  })
}

export function reloadWisdom() {
  if (!state.currentUser) return
  localStorage.removeItem(`tracker-wisdom-${state.currentUser.id}`)
  const wisdomEl = document.getElementById('wisdom-card')
  if (wisdomEl) { wisdomEl.dataset.loaded = ''; loadWisdom(wisdomEl) }
}

function renderTodayWeightSection(weights, today) {
  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date))
  const todayEntry = sorted.find(w => w.date === today)
  if (!todayEntry) {
    return `<button class="log-add-btn" data-action="log-weight">+ Log today's weight</button>`
  }
  const prev = sorted.find(w => w.date < today)
  const delta = prev ? todayEntry.kg - prev.kg : null
  let dHtml = ''
  if (delta !== null) {
    const cls = delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'same'
    dHtml = `<span class="delta ${cls}">${delta > 0 ? '+' : ''}${delta.toFixed(2)} kg</span>`
  }
  return `
    <button class="log-add-btn" style="margin-bottom:12px" data-action="log-weight">+ Log today's weight</button>
    ${sparklineHTML(sorted, { compact: false })}
    <div class="weight-entry">
      <div class="weight-entry-date">${fmtDateShort(todayEntry.date)}</div>
      <div class="weight-entry-right">
        ${dHtml}
        <div class="weight-entry-kg">${todayEntry.kg.toFixed(2)}<span style="font-size:12px;font-weight:400;color:var(--tx3)"> kg</span></div>
      </div>
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
        <div class="entry-menu">
          <button data-action="edit-weight" data-date="${todayEntry.date}">Edit</button>
          <button class="danger" data-action="delete-weight" data-date="${todayEntry.date}">Delete</button>
        </div>
      </div>
    </div>`
}

export async function renderToday() {
  if (!state.currentUser) {
    document.getElementById('cal-section').innerHTML    = ''
    document.getElementById('macro-rings').innerHTML    = ''
    document.getElementById('week-chart-card').innerHTML = ''
    document.getElementById('streak-card').innerHTML    = ''
    document.getElementById('wisdom-card').innerHTML    = ''
    document.getElementById('today-logs').innerHTML     = ''
    return
  }

  const data        = await db.load()
  const today       = dateStr()
  const allFood     = data.food[today]     || []
  const trackSupps  = state.settings?.track_supplements ?? false
  const supplements = trackSupps ? allFood.filter(e => e.meal === 'supplement') : []
  const food        = trackSupps ? allFood.filter(e => e.meal !== 'supplement') : allFood
  const workouts    = data.workouts[today] || []
  const totals      = sumFood(food)
  const calTarget   = getCalorieGoal()
  const burnedToday      = calculateNetActiveCalories(workouts)
  const burnedTotalToday = calculateTotalActivityCalories(workouts, TARGETS.calories.bmr || 1800)
  const eatbackPct  = TARGETS.calories.eatback_enabled !== false ? (TARGETS.calories.eatback_pct ?? 50) : 0
  const eatback     = burnedToday > 0 ? Math.round(burnedToday * eatbackPct / 100) : 0

  const effectiveTarget = calTarget + eatback
  renderPanel(document.getElementById('cal-section'),
    calRingHTML(totals.calories, effectiveTarget, burnedToday, computeMealFrac(data, effectiveTarget)) +
    `<div class="cal-badges">
       <span class="badge">Target: ${effectiveTarget.toLocaleString()} kcal${eatback > 0 ? ` (+${eatback} eat-back)` : ''}</span>
       ${burnedToday > 0 ? `<span class="badge"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">local_fire_department</span> ${burnedToday.toLocaleString()} burned${burnedTotalToday > burnedToday ? `<span style="opacity:.65;margin-left:3px">(${burnedTotalToday.toLocaleString()} total)</span>` : ''}</span>` : ''}
     </div>`)

  const creatineTarget = state.settings?.creatine_target_g ?? 5
  const creatineDose   = trackSupps
    ? supplements.reduce((sum, e) => sum + (e.supplement_dose_g || 0), 0)
    : 0

  const ringCount = 3 + (trackSupps ? 1 : 0)
  const ringsEl = document.getElementById('macro-rings')
  ringsEl.className = 'macro-rings' + (ringCount >= 5 ? ' rings-5' : ringCount === 4 ? ' rings-4' : '')
  renderPanel(ringsEl,
    macroRingHTML('Protein', totals.protein, TARGETS.protein, 'g', MACRO_COLORS.protein) +
    macroRingHTML('Carbs',   totals.carbs,   TARGETS.carbs,   'g', MACRO_COLORS.carbs) +
    macroRingHTML('Fat',     totals.fat,     TARGETS.fat,     'g', MACRO_COLORS.fat) +
    (trackSupps ? macroRingHTML('Creatine', creatineDose, creatineTarget, 'g', CREATINE_COLOR) : ''))

  renderPanel(document.getElementById('week-chart-card'), weekChartHTML(data))
  renderPanel(document.getElementById('streak-card'),     streakHTML(data))

  const wisdomEl = document.getElementById('wisdom-card')
  if (wisdomEl && !wisdomEl.dataset.loaded) {
    loadWisdom(wisdomEl)
  }

  const orderedFood = food
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const mealA = MEAL_ORDER.indexOf(a.entry.meal || 'snack')
      const mealB = MEAL_ORDER.indexOf(b.entry.meal || 'snack')
      return (mealA - mealB) || (a.index - b.index)
    })
    .map(({ entry }) => entry)

  renderPanel(document.getElementById('today-logs'), `
    <div class="section-label">Food</div>
    ${stagger(orderedFood, e => foodItem(e, today))}
    <button class="log-add-btn" data-action="open-food-sheet" data-meal="snack">+ Add meal</button>
    ${trackSupps ? `
    <div class="section-label" style="margin-top:14px">Supplements</div>
    ${stagger(supplements, e => supplementItem(e, today))}
    <button class="log-add-btn" data-action="open-supplement-sheet">+ Log supplement</button>` : ''}
    <div class="section-label" style="margin-top:14px">Activities</div>
    ${stagger(groupWorkoutsByConflict(workouts), item =>
      item.type === 'stack' ? workoutStack(item.entries, today) : workoutItem(item.entry, today)
    )}
    <button class="log-add-btn" data-action="open-workout-sheet">+ Add activity</button>
    <div class="section-label" style="margin-top:14px">Weight</div>
    ${renderTodayWeightSection(data.weights || [], today)}
  `)
}

export function openFoodSheet(meal = 'snack', date = null) {
  state.pendingEditFoodId = null
  state.pendingClaudeDraft = null
  state.pendingFoodDate   = date
  const title = document.getElementById('food-sheet-title')
  if (title) title.textContent = 'Log Food'
  const banner = document.getElementById('preset-match-banner')
  if (banner) {
    banner.style.display = 'none'
    banner.textContent = ''
  }
  const d = date || dateStr()
  document.getElementById('log-food-btn').textContent = 'Log Food'
  document.getElementById('f-date').value = d
  document.querySelectorAll('#food-sheet .meal-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.meal === meal))
  document.getElementById('f-desc').value = ''
  document.getElementById('f-cal').value  = ''
  document.getElementById('f-pro').value  = ''
  document.getElementById('f-car').value  = ''
  document.getElementById('f-fat').value  = ''
  document.getElementById('f-desc-ac').classList.remove('open')
  openSheet('food-sheet')
  setTimeout(() => document.getElementById('f-desc').focus(), 360)
}

export function openFoodSheetWithPreset(preset) {
  state.pendingEditFoodId = null
  state.pendingClaudeDraft = null
  state.pendingFoodDate   = null
  const title = document.getElementById('food-sheet-title')
  if (title) title.textContent = 'Log Food'
  document.getElementById('log-food-btn').textContent = 'Log Food'
  document.getElementById('f-date').value = dateStr()
  document.querySelectorAll('#food-sheet .meal-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.meal === (preset.meal || 'snack')))
  document.getElementById('f-desc').value = preset.name || ''
  document.getElementById('f-cal').value  = preset.calories || ''
  document.getElementById('f-pro').value  = preset.protein  || ''
  document.getElementById('f-car').value  = preset.carbs    || ''
  document.getElementById('f-fat').value  = preset.fat      || ''
  document.getElementById('f-desc-ac').classList.remove('open')
  const banner = document.getElementById('preset-match-banner')
  banner.textContent = `Matched from saved meal: ${preset.name}`
  banner.style.display = 'block'
  openSheet('food-sheet')
}

export function editFood(id, date) {
  closeMenus()
  state.pendingClaudeDraft = null
  const banner = document.getElementById('preset-match-banner')
  if (banner) {
    banner.style.display = 'none'
    banner.textContent = ''
  }
  // Find entry in cache
  let entry = null, entryDate = date
  if (date && state.dbCache?.food[date]) {
    entry = state.dbCache.food[date].find(e => e.id === id) || null
  }
  if (!entry && state.dbCache) {
    for (const [d, entries] of Object.entries(state.dbCache.food)) {
      const found = entries.find(e => e.id === id)
      if (found) { entry = found; entryDate = d; break }
    }
  }
  if (!entry) return

  const title = document.getElementById('food-sheet-title')
  if (title) title.textContent = isSavedMealEntry(entry) ? 'Edit Preset' : 'Edit Food'

  state.pendingEditFoodId = id
  state.pendingFoodDate   = entryDate
  document.getElementById('f-date').value = entryDate
  document.getElementById('f-desc').value = entry.description || ''
  document.getElementById('f-cal').value  = entry.calories || ''
  document.getElementById('f-pro').value  = entry.protein  || ''
  document.getElementById('f-car').value  = entry.carbs    || ''
  document.getElementById('f-fat').value  = entry.fat      || ''
  document.querySelectorAll('#food-sheet .meal-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.meal === (entry.meal || 'breakfast')))
  document.getElementById('log-food-btn').textContent = 'Update Food'
  document.getElementById('f-date').disabled = true
  openSheet('food-sheet')
}

export function openWorkoutSheet(date = null) {
  closeMenus()
  state.pendingEditWorkoutId = null
  state.pendingClaudeDraft = null
  state.pendingWorkoutDate   = date
  const title = document.getElementById('workout-sheet-title')
  if (title) title.textContent = 'Log Activity'
  const banner = document.getElementById('workout-draft-banner')
  if (banner) {
    banner.style.display = 'none'
    banner.textContent = ''
  }
  document.getElementById('w-desc-ac')?.classList.remove('open')
  document.getElementById('w-desc').value = ''
  document.getElementById('w-date').value = date || dateStr()
  document.getElementById('w-time').value = ''
  document.getElementById('w-activity-type').value = ''
  document.getElementById('w-calories-burned').value = ''
  document.getElementById('w-duration-min').value = ''
  document.getElementById('w-distance-km').value  = ''
  document.getElementById('w-heart-rate').value   = ''
  document.querySelectorAll('#intensity-btns-main .intensity-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.intensity === 'medium'))
  document.getElementById('save-workout-btn').textContent = 'Log Activity'
  openSheet('intensity-sheet')
  setTimeout(() => document.getElementById('w-desc').focus(), 360)
}

export function editWorkout(id, date) {
  closeMenus()
  state.pendingClaudeDraft = null
  let entry = null, entryDate = date
  if (date && state.dbCache?.workouts[date]) {
    entry = state.dbCache.workouts[date].find(e => e.id === id) || null
  }
  if (!entry && state.dbCache) {
    for (const [d, entries] of Object.entries(state.dbCache.workouts)) {
      const found = entries.find(e => e.id === id)
      if (found) { entry = found; entryDate = d; break }
    }
  }
  if (!entry) return

  state.pendingEditWorkoutId = id
  state.pendingWorkoutDate   = entryDate
  const title = document.getElementById('workout-sheet-title')
  if (title) title.textContent = 'Edit Activity'
  const banner = document.getElementById('workout-draft-banner')
  if (banner) {
    banner.style.display = 'none'
    banner.textContent = ''
  }
  document.getElementById('w-desc-ac')?.classList.remove('open')
  document.getElementById('w-desc').value = entry.description || ''
  document.getElementById('w-date').value = entryDate
  document.getElementById('w-time').value = entry.time ? entry.time.slice(11, 16) : ''
  document.getElementById('w-activity-type').value   = entry.activity_type   || ''
  document.getElementById('w-calories-burned').value = entry.calories_burned || ''
  document.getElementById('w-duration-min').value    = entry.duration_min    || ''
  document.getElementById('w-distance-km').value     = entry.distance_km     || ''
  document.getElementById('w-heart-rate').value      = entry.heart_rate_avg  || ''
  document.querySelectorAll('#intensity-btns-main .intensity-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.intensity === (entry.intensity || 'medium')))
  document.getElementById('save-workout-btn').textContent = 'Update Activity'
  document.getElementById('w-date').disabled = false
  openSheet('intensity-sheet')
}

export function openSupplementSheet(date = null) {
  state.pendingEditSupplementId = null
  state.pendingSupplementDate   = date
  document.getElementById('s-date').value = date || dateStr()
  document.getElementById('s-name').value = 'Creatine Monohydrate'
  document.getElementById('s-dose').value = state.settings?.creatine_target_g ?? 5
  document.getElementById('save-supplement-btn').textContent = 'Log Creatine'
  openSheet('supplement-sheet')
}

export function editSupplement(id, date) {
  closeMenus()
  let entry = null, entryDate = date
  if (date && state.dbCache?.food[date]) {
    entry = state.dbCache.food[date].find(e => e.id === id) || null
  }
  if (!entry && state.dbCache) {
    for (const [d, entries] of Object.entries(state.dbCache.food)) {
      const found = entries.find(e => e.id === id)
      if (found) { entry = found; entryDate = d; break }
    }
  }
  if (!entry) return

  state.pendingEditSupplementId = id
  state.pendingSupplementDate   = entryDate
  document.getElementById('s-date').value = entryDate
  document.getElementById('s-name').value = entry.description || ''
  document.getElementById('s-dose').value = entry.supplement_dose_g || ''
  document.getElementById('save-supplement-btn').textContent = 'Update Creatine'
  openSheet('supplement-sheet')
}

export async function saveToMeals(id, date) {
  closeMenus()
  let entry = null
  if (date && state.dbCache?.food[date]) {
    entry = state.dbCache.food[date].find(e => e.id === id) || null
  }
  if (!entry && state.dbCache) {
    entry = Object.values(state.dbCache.food).flat().find(e => e.id === id) || null
  }
  if (!entry) return
  try {
    await db.addMeal({ name: entry.description, calories: entry.calories||0, protein: entry.protein||0, carbs: entry.carbs||0, fat: entry.fat||0 })
    state.mealsCache = null
    showToast(`✅ Saved "${entry.description}" to meals`)
  } catch (e) { showToast('❌ ' + e.message) }
}

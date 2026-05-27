import { TARGETS, MEAL_ORDER, MEAL_LABEL, MEAL_ICON } from '../config.js'
import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr, sumFood, calculateNetActiveCalories, fmtDateShort } from '../utils.js'
import { stagger, renderPanel } from '../animate.js'
import { calRingHTML, macroRingHTML, weekChartHTML, streakHTML, sparklineHTML } from '../charts.js'
import { foodItem, workoutItem, groupWorkoutsByConflict, workoutStack } from '../renderers.js'
import { openSheet, showToast, closeMenus } from '../ui.js'
import { fetchDailyWisdom } from '../ai.js'
import { materialIcon } from '../icons.js'

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

  const data     = await db.load()
  const today    = dateStr()
  const food     = data.food[today]     || []
  const workouts = data.workouts[today] || []
  const totals      = sumFood(food)
  const training    = workouts.some(w => !w.isDuplicate)
  const calTarget   = TARGETS.calories.rest
  const burnedToday = calculateNetActiveCalories(workouts, TARGETS.calories.bmr)

  renderPanel(document.getElementById('cal-section'),
    calRingHTML(totals.calories, calTarget, burnedToday) +
    `<div class="cal-badges">
       <span class="badge ${training?'training':''}}">${training ? 'Training day' : 'Rest day'}</span>
       <span class="badge">Target: ${(calTarget + burnedToday).toLocaleString()} kcal${burnedToday > 0 ? ' (+'+burnedToday+' burned)' : ''}</span>
     </div>`)

  renderPanel(document.getElementById('macro-rings'),
    macroRingHTML('Protein', totals.protein, TARGETS.protein, 'g', 'var(--accent)') +
    macroRingHTML('Carbs',   totals.carbs,   TARGETS.carbs,   'g', '#3b82f6') +
    macroRingHTML('Fat',     totals.fat,      TARGETS.fat,      'g', '#f59e0b'))

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
  state.pendingFoodDate   = date
  const banner = document.getElementById('preset-match-banner')
  if (banner) banner.style.display = 'none'
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
  state.pendingFoodDate   = null
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
  const banner = document.getElementById('preset-match-banner')
  if (banner) banner.style.display = 'none'
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
  state.pendingWorkoutDate   = date
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

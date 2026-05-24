import { TARGETS, MEAL_ORDER, MEAL_LABEL } from '../config.js'
import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr } from '../utils.js'
import { sumFood } from '../utils.js'
import { calRingHTML, macroRingHTML, weekChartHTML, macroBarsHTML, streakHTML } from '../charts.js'
import { foodItem, workoutItem } from '../renderers.js'
import { openSheet, showToast, closeMenus } from '../ui.js'

export async function renderToday() {
  if (!state.currentUser) {
    document.getElementById('cal-section').innerHTML   = ''
    document.getElementById('macro-rings').innerHTML   = ''
    document.getElementById('week-chart-card').innerHTML = ''
    document.getElementById('streak-card').innerHTML   = ''
    document.getElementById('macro-bar-card').innerHTML = ''
    document.getElementById('today-logs').innerHTML = `
      <div class="signin-prompt">
        <div class="signin-icon">🚴</div>
        <div class="signin-title">MyTracker</div>
        <div class="signin-sub">Sign in to load your data</div>
        <button class="github-signin-btn" data-action="signin">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.57C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
          Sign in with GitHub
        </button>
      </div>`
    return
  }

  const data     = await db.load()
  const today    = dateStr()
  const food     = data.food[today]     || []
  const workouts = data.workouts[today] || []
  const totals      = sumFood(food)
  const training    = workouts.length > 0
  const calTarget   = training ? TARGETS.calories.training : TARGETS.calories.rest
  const burnedToday = workouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0)

  document.getElementById('cal-section').innerHTML =
    calRingHTML(totals.calories, calTarget, burnedToday) +
    `<div class="cal-badges">
       <span class="badge ${training?'training':''}}">${training ? 'Training day' : 'Rest day'}</span>
       <span class="badge">Target: ${(calTarget + burnedToday).toLocaleString()} kcal${burnedToday > 0 ? ' (+'+burnedToday+' burned)' : ''}</span>
     </div>`

  document.getElementById('macro-rings').innerHTML =
    macroRingHTML('Protein', totals.protein, TARGETS.protein, 'g', 'var(--accent)') +
    macroRingHTML('Carbs',   totals.carbs,   TARGETS.carbs,   'g', '#3b82f6') +
    macroRingHTML('Fat',     totals.fat,      TARGETS.fat,      'g', '#f59e0b')

  document.getElementById('week-chart-card').innerHTML  = weekChartHTML(data)
  document.getElementById('streak-card').innerHTML      = streakHTML(data)
  document.getElementById('macro-bar-card').innerHTML   = macroBarsHTML(totals)

  // Group food by meal
  const mealSections = MEAL_ORDER.map(meal => {
    const items = food.filter(e => (e.meal || 'snack') === meal)
    if (!items.length) return ''
    return `
      <div class="meal-section">
        <div class="meal-section-hd">${MEAL_LABEL[meal]}</div>
        ${items.map(e => foodItem(e, today)).join('')}
      </div>`
  }).join('')

  document.getElementById('today-logs').innerHTML = `
    <div class="section-label">Food</div>
    ${mealSections || ''}
    <button class="log-add-btn" data-action="open-food-sheet" data-meal="snack">+ Add meal</button>
    <div class="section-label" style="margin-top:14px">Activities</div>
    ${workouts.map(e => workoutItem(e, today)).join('')}
    <button class="log-add-btn" data-action="open-workout-sheet">+ Add activity</button>
  `
}

export function openFoodSheet(meal = 'snack', date = null) {
  state.pendingEditFoodId = null
  state.pendingFoodDate   = date
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

export function editFood(id, date) {
  closeMenus()
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
  state.pendingEditWorkoutId = null
  state.pendingWorkoutDate   = date
  document.getElementById('w-desc').value = ''
  document.getElementById('w-date').value = date || dateStr()
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
  document.getElementById('w-desc').value = entry.description || ''
  document.getElementById('w-date').value = entryDate
  document.getElementById('w-activity-type').value   = entry.activity_type   || ''
  document.getElementById('w-calories-burned').value = entry.calories_burned || ''
  document.getElementById('w-duration-min').value    = entry.duration_min    || ''
  document.getElementById('w-distance-km').value     = entry.distance_km     || ''
  document.getElementById('w-heart-rate').value      = entry.heart_rate_avg  || ''
  document.querySelectorAll('#intensity-btns-main .intensity-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.intensity === (entry.intensity || 'medium')))
  document.getElementById('save-workout-btn').textContent = 'Update Activity'
  document.getElementById('w-date').disabled = true
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
    await db.addMeal({ name: entry.description, calories: entry.calories||0, protein: entry.protein||0, carbs: entry.carbs||0, fat: entry.fat||0, meal: entry.meal||'snack' })
    state.mealsCache = null
    showToast(`✅ Saved "${entry.description}" to meals`)
  } catch (e) { showToast('❌ ' + e.message) }
}

import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr, sumFood } from '../utils.js'
import { openSheet, showToast, closeMenus } from '../ui.js'
import { wisdomReloadToken } from '../../stores.js'
import { get } from 'svelte/store'

export function reloadWisdom() {
  if (!state.currentUser) return
  localStorage.removeItem(`tracker-wisdom-${state.currentUser.id}`)
  wisdomReloadToken.update(n => n + 1)
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
  if (banner) { banner.style.display = 'none'; banner.textContent = '' }
  const title = document.getElementById('food-sheet-title')
  if (title) title.textContent = 'Edit Food'
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
  state.pendingClaudeDraft = null
  state.pendingWorkoutDate   = date
  const title = document.getElementById('workout-sheet-title')
  if (title) title.textContent = 'Log Activity'
  const banner = document.getElementById('workout-draft-banner')
  if (banner) { banner.style.display = 'none'; banner.textContent = '' }
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
  if (banner) { banner.style.display = 'none'; banner.textContent = '' }
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

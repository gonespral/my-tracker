import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr } from '../utils.js'
import { openSheet, showToast, closeMenus } from '../ui.js'
import { wisdomReloadToken, foodDraft, workoutDraft } from '../../stores.js'

export function reloadWisdom() {
  if (!state.currentUser) return
  localStorage.removeItem(`tracker-wisdom-${state.currentUser.id}`)
  wisdomReloadToken.update(n => n + 1)
}

export function openFoodSheet(meal = 'snack', date = null) {
  state.pendingClaudeDraft = null
  foodDraft.set({
    meal,
    date: date || dateStr(),
    desc: '',
    cal: '',
    pro: '',
    car: '',
    fat: '',
    editId: null,
    banner: '',
  })
  openSheet('food-sheet')
}

export function openFoodSheetWithPreset(preset) {
  state.pendingClaudeDraft = null
  foodDraft.set({
    meal: preset.meal || 'snack',
    date: dateStr(),
    desc: preset.name || '',
    cal: preset.calories || '',
    pro: preset.protein || '',
    car: preset.carbs || '',
    fat: preset.fat || '',
    editId: null,
    banner: `Matched from saved meal: ${preset.name}`,
  })
  openSheet('food-sheet')
}

export function editFood(id, date) {
  closeMenus()
  state.pendingClaudeDraft = null
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
  foodDraft.set({
    meal: entry.meal || 'breakfast',
    date: entryDate,
    desc: entry.description || '',
    cal: entry.calories || '',
    pro: entry.protein || '',
    car: entry.carbs || '',
    fat: entry.fat || '',
    editId: id,
    banner: '',
  })
  openSheet('food-sheet')
}

export function openWorkoutSheet(date = null) {
  closeMenus()
  state.pendingClaudeDraft = null
  workoutDraft.set({
    desc: '',
    date: date || dateStr(),
    time: '',
    intensity: 'medium',
    activityType: '',
    calsBurned: '',
    durationMin: '',
    distanceKm: '',
    heartRate: '',
    editId: null,
    banner: '',
    claudeDraft: false,
  })
  openSheet('intensity-sheet')
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
  workoutDraft.set({
    desc: entry.description || '',
    date: entryDate,
    time: entry.time ? entry.time.slice(11, 16) : '',
    intensity: entry.intensity || 'medium',
    activityType: entry.activity_type || '',
    calsBurned: entry.calories_burned || '',
    durationMin: entry.duration_min || '',
    distanceKm: entry.distance_km || '',
    heartRate: entry.heart_rate_avg || '',
    editId: id,
    banner: '',
    claudeDraft: false,
  })
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

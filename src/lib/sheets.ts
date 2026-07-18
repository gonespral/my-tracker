import { useAppStore } from '../store'
import type { FoodEntry, WorkoutEntry, MealPreset, WorkoutPreset } from './utils'

export function openFoodSheet(date: string | null = null) {
  useAppStore.setState({ openSheetId: 'food', sheetDate: date, editingFood: null })
}

export function openEditFoodSheet(entry: FoodEntry) {
  useAppStore.setState({ openSheetId: 'food', editingFood: entry })
}

export function openActivitySheet(date: string | null = null) {
  useAppStore.setState({ openSheetId: 'activity', sheetDate: date, editingWorkout: null })
}

export function openEditActivitySheet(entry: WorkoutEntry) {
  useAppStore.setState({ openSheetId: 'activity', editingWorkout: entry })
}

export function openWeightSheet(date: string | null = null) {
  useAppStore.setState({ openSheetId: 'weight', sheetDate: date, editingWeight: null })
}

export function openEditWeightSheet(entry: { date: string; kg: number }) {
  useAppStore.setState({ openSheetId: 'weight', editingWeight: entry })
}

export function openIntegrationsSheet() {
  useAppStore.setState({ openSheetId: 'integrations' })
}

export function openApiKeySheet() {
  useAppStore.setState({ openSheetId: 'apikey' })
}

export function openSettingsSheet() {
  useAppStore.setState({ openSheetId: 'settings' })
}

export function openMealPresetSheet(preset: MealPreset | null = null) {
  useAppStore.setState({ openSheetId: 'mealPreset', editingMealPreset: preset })
}

export function openWorkoutPresetSheet(preset: WorkoutPreset | null = null) {
  useAppStore.setState({ openSheetId: 'workoutPreset', editingWorkoutPreset: preset })
}

export function closeSheet() {
  // Preset sheets are opened from inside Settings — closing one (dismiss or
  // save) returns to Settings rather than closing everything, mirroring the
  // old app's returnToSheetId behavior.
  const openId = useAppStore.getState().openSheetId
  if (openId === 'mealPreset' || openId === 'workoutPreset') {
    useAppStore.setState({ openSheetId: 'settings', editingMealPreset: null, editingWorkoutPreset: null })
    return
  }
  useAppStore.setState({
    openSheetId: null,
    sheetDate: null,
    editingFood: null,
    editingWorkout: null,
    editingWeight: null,
  })
}

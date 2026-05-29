import { writable } from 'svelte/store'

export const currentUser  = writable(null)
export const activeTab    = writable(localStorage.getItem('tracker-tab') || 'today')
export const dbCache      = writable(null)
export const dataGen      = writable(0)
export const mealsCache   = writable(null)
export const workoutPresetsCache = writable(null)
export const workoutConflictGroups = writable(null)

// Unified pending edit: { type: 'food'|'workout'|'weight'|'preset'|'workout-preset'|null, id: any }
export const pendingEdit  = writable({ type: null, id: null })

// Date context for new entries (null = today)
export const pendingFoodDate    = writable(null)
export const pendingWorkoutDate = writable(null)
export const pendingClaudeDraft = writable(null)
export const returnToSheetId    = writable(null)

// Date pickers for history tabs
export const nutritionDate = writable(null)
export const workoutsDate  = writable(null)

// Chat
export const chatApiMessages = writable([])
export const chatDisplay     = writable([])
export const chatPending     = writable(false)

// UI
export const statsOpen  = writable(false)
export const toastMsg   = writable(null)
export const toastTimer = writable(null)

// Which sheet is open (only one at a time)
export const openSheetId = writable(null)

// Draft state for the food and workout sheets
export const foodDraft = writable({ meal: 'snack', date: '', desc: '', cal: '', pro: '', car: '', fat: '', editId: null, banner: '' })
export const workoutDraft = writable({ desc: '', date: '', time: '', intensity: 'medium', activityType: '', calsBurned: '', durationMin: '', distanceKm: '', heartRate: '', editId: null, banner: '', claudeDraft: false })

// Heatmap month offset
export const heatmapMonthOffset = writable(0)

// Conflict groups expanded set (stored as a writable so components can react)
export const expandedConflictGroups = writable(new Set())

// Speech
export const listening = writable(false)

// Wisdom reload trigger (incremented by reloadWisdom())
export const wisdomReloadToken = writable(0)

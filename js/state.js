// Shared mutable state — imported as a singleton across all modules
export const state = {
  currentUser:  null,
  dbCache:      null,
  mealsCache:   null,
  workoutPresetsCache: null,
  workoutConflictGroups: null,
  activeTab:    'today',

  // Pending edits
  pendingEditFoodId:          null,
  pendingEditWorkoutId:       null,
  pendingEditWeightDate:      null,
  pendingEditPresetId:        null,
  pendingEditWorkoutPresetId: null,

  // Date context for new entries (null = today)
  pendingFoodDate:    null,
  pendingWorkoutDate: null,

  // Date pickers in history tabs
  nutritionDate: null,
  workoutsDate:  null,

  // Chat
  chatApiMessages: [],
  chatDisplay:     [],
  chatPending:     false,

  // UI
  statsOpen: false,
  toastTmr:  null,

  // Speech
  recognition:   null,
  listening:     false,
  speechHandled: false,
}

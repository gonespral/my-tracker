// Shared mutable state — imported as a singleton across all modules
export const state = {
  currentUser:  null,
  dbCache:      null,
  dataGen:      0,   // incremented on every db.bust(); used to skip redundant tab re-renders
  mealsCache:   null,
  workoutPresetsCache: null,
  workoutConflictGroups: null,
  pendingClaudeDraft: null,
  activeTab:    'today',
  heatmapMonthOffset: 0,

  // Pending edits
  pendingEditFoodId:          null,
  pendingEditWorkoutId:       null,
  pendingEditWeightDate:      null,
  pendingEditPresetId:        null,
  pendingEditWorkoutPresetId: null,
  returnToSheetId:            null,

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
  expandedConflictGroups: new Set(),

  // Speech
  recognition:   null,
  listening:     false,
  speechHandled: false,

  // Cached Supabase user_settings row (populated on auth, updated on save)
  settings: {},
}

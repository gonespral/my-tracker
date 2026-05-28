/**
 * Compatibility shim: wraps Svelte stores in a mutable-object interface so all
 * existing lib files can keep `import { state } from './state.js'` unchanged.
 *
 * Reading  state.xyz  →  get(store)
 * Writing  state.xyz = v  →  store.set(v)
 *
 * Complex mutations (push, add, delete) work because they receive the same
 * reference as the store value; lib files that do state.arr.push() should
 * follow up with a store.set(state.arr) call — or the Svelte component can
 * use $store with a reactive declaration to re-read after explicit renderActive().
 *
 * Properties NOT in the store map fall through to a plain local object (e.g.
 * state.recognition, state.speechHandled, state.toastTmr).
 */
import { get } from 'svelte/store'
import {
  currentUser, dbCache, dataGen,
  mealsCache, workoutPresetsCache, workoutConflictGroups,
  pendingEdit, pendingClaudeDraft, returnToSheetId,
  pendingFoodDate, pendingWorkoutDate,
  nutritionDate, workoutsDate,
  chatApiMessages, chatDisplay, chatPending,
  statsOpen, toastMsg, toastTimer, openSheetId,
  heatmapMonthOffset, expandedConflictGroups, listening,
  activeTab,
} from '../stores.js'

const STORE_MAP = {
  currentUser,
  dbCache,
  dataGen,
  mealsCache,
  workoutPresetsCache,
  workoutConflictGroups,
  pendingClaudeDraft,
  returnToSheetId,
  pendingFoodDate,
  pendingWorkoutDate,
  nutritionDate,
  workoutsDate,
  chatApiMessages,
  chatDisplay,
  chatPending,
  statsOpen,
  toastTmr: toastTimer,
  openSheetId,
  heatmapMonthOffset,
  expandedConflictGroups,
  listening,
  activeTab,
}

// Unified pendingEdit handlers (old multi-field API → new single store)
const PENDING_EDIT_KEYS = {
  pendingEditFoodId: 'food',
  pendingEditWorkoutId: 'workout',
  pendingEditWeightDate: 'weight',
  pendingEditPresetId: 'preset',
  pendingEditWorkoutPresetId: 'workout-preset',
}

const _local = {}

export const state = new Proxy(_local, {
  get(target, key) {
    if (key in PENDING_EDIT_KEYS) {
      const pe = get(pendingEdit)
      return pe.type === PENDING_EDIT_KEYS[key] ? pe.id : null
    }
    if (key in STORE_MAP) return get(STORE_MAP[key])
    return target[key]
  },
  set(target, key, value) {
    if (key in PENDING_EDIT_KEYS) {
      if (value === null || value === undefined) {
        pendingEdit.set({ type: null, id: null })
      } else {
        pendingEdit.set({ type: PENDING_EDIT_KEYS[key], id: value })
      }
      return true
    }
    if (key in STORE_MAP) {
      STORE_MAP[key].set(value)
      return true
    }
    target[key] = value
    return true
  },
  has(target, key) {
    return key in PENDING_EDIT_KEYS || key in STORE_MAP || key in target
  },
})

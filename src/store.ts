import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { FoodEntry, WorkoutEntry, MealPreset, WorkoutPreset } from './lib/utils'

export interface DbCache {
  food: Record<string, FoodEntry[]>
  workouts: Record<string, WorkoutEntry[]>
  weights: { date: string; kg: number }[]
}

export interface ConflictGroup {
  date: string
  sources: string[]
  preferredSource: string
  activeSource: string
  activeId?: string
}

export type SheetId = 'food' | 'activity' | 'weight' | 'integrations' | 'apikey' | 'settings' | 'mealPreset' | 'workoutPreset'

export type ChatDisplayMessage =
  | { role: 'user'; text: string; imageCount?: number }
  | { role: 'assistant'; text: string; thinking?: boolean }
  | { role: 'tool'; items: { label: string; ok: boolean }[] }

export interface ChatApiMessage {
  role: 'user' | 'assistant'
  content: unknown
}

export type ChatPanelState = 'collapsed' | 'peek' | 'expanded'

interface AppState {
  currentUser: User | { id: string; email: string; user_metadata: Record<string, unknown> } | null
  dbCache: DbCache | null
  dataGen: number // incremented on every db.bust(); used to skip redundant tab re-renders
  mealsCache: MealPreset[] | null
  workoutPresetsCache: WorkoutPreset[] | null
  workoutConflictGroups: Record<string, ConflictGroup> | null
  activeTab: 'today' | 'activities' | 'nutrition'
  heatmapMonthOffset: number

  // Sheets (bottom-drawer forms) — see src/lib/sheets.ts for open/close helpers.
  // `editing*` holds the full entry being edited (null when adding new), and
  // `sheetDate` is the date context for a *new* entry (null = today).
  openSheetId: SheetId | null
  sheetDate: string | null
  editingFood: FoodEntry | null
  editingWorkout: WorkoutEntry | null
  editingWeight: { date: string; kg: number } | null
  editingMealPreset: MealPreset | null
  editingWorkoutPreset: WorkoutPreset | null

  // Date pickers in history tabs
  nutritionDate: string | null
  activitiesDate: string | null

  // Chat
  chatApiMessages: ChatApiMessage[]
  chatDisplay: ChatDisplayMessage[]
  chatPending: boolean
  chatPanelState: ChatPanelState

  // UI
  tutorialOpen: boolean
  statsOpen: boolean
  expandedConflictGroups: Set<string>
  openEntryMenuId: string | null

  // Speech
  listening: boolean

  // Cached Supabase user_settings row (populated on auth, updated on save)
  settings: Record<string, unknown>

  // Sync status (Supabase/Strava/Google Health background fetches)
  syncCounts: Record<string, number>
  syncFailed: Set<string>
}

export const useAppStore = create<AppState>(() => ({
  currentUser: null,
  dbCache: null,
  dataGen: 0,
  mealsCache: null,
  workoutPresetsCache: null,
  workoutConflictGroups: null,
  activeTab: 'today',
  heatmapMonthOffset: 0,

  openSheetId: null,
  sheetDate: null,
  editingFood: null,
  editingWorkout: null,
  editingWeight: null,
  editingMealPreset: null,
  editingWorkoutPreset: null,

  nutritionDate: null,
  activitiesDate: null,

  chatApiMessages: [],
  chatDisplay: [],
  chatPending: false,
  chatPanelState: 'collapsed',

  tutorialOpen: false,
  statsOpen: false,
  expandedConflictGroups: new Set(),
  openEntryMenuId: null,

  listening: false,

  settings: {},

  syncCounts: {},
  syncFailed: new Set(),
}))

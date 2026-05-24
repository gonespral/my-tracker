import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
import { state } from './state.js'

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const CONFLICT_PREFERENCE_KEY = 'tracker-workout-conflict-preference'
const CONFLICT_OVERRIDES_KEY = 'tracker-workout-conflict-overrides'
const CONFLICT_DISMISSALS_KEY = 'tracker-workout-conflict-dismissals'
const CONFLICT_INTEGRATIONS = new Set(['strava', 'google-health', 'fitbit', 'manual'])

function readConflictOverrides() {
  try {
    return JSON.parse(localStorage.getItem(CONFLICT_OVERRIDES_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeConflictOverrides(overrides) {
  localStorage.setItem(CONFLICT_OVERRIDES_KEY, JSON.stringify(overrides))
}

function readConflictDismissals() {
  try {
    return JSON.parse(localStorage.getItem(CONFLICT_DISMISSALS_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeConflictDismissals(dismissals) {
  localStorage.setItem(CONFLICT_DISMISSALS_KEY, JSON.stringify(dismissals))
}

export function parseWorkoutStart(date, time) {
  if (!time) return null

  const d = new Date(time)
  if (!isNaN(d.getTime()) && time.includes('T')) {
    return d.getTime()
  }

  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i)
  if (!match) return null

  let hours = Number(match[1]) % 12
  if (match[3].toLowerCase() === 'pm') hours += 12
  const minutes = Number(match[2])
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime()
}

function normalizeWorkoutType(workout) {
  const type = (workout.activity_type || workout.sport_type || workout.description || '').toString().toLowerCase()
  if (/(ride|bike|cycling|biking|mountainbike)/.test(type)) return 'cycle'
  if (/(run|jog|sprint|5k|10k|marathon|tempo)/.test(type)) return 'run'
  if (/(walk|hike|trail)/.test(type)) return 'walk'
  if (/(swim|pool|lap)/.test(type)) return 'swim'
  if (/(row|rowing|kayak|canoe)/.test(type)) return 'row'
  if (/(yoga|pilates|stretch)/.test(type)) return 'yoga'
  if (/(crossfit|hiit|tabata|circuit|cardio)/.test(type)) return 'hiit'
  if (/(tennis|padel|squash|badminton|racket|racquet)/.test(type)) return 'tennis'
  if (/(climb|boulder|rock)/.test(type)) return 'climb'
  if (/(football|soccer|basketball|rugby|volley|hockey|ball)/.test(type)) return 'ball'
  if (/(box|boxing|kickbox|muay|mma|judo|karate|wrestling|martial|combat)/.test(type)) return 'box'
  return workout.activity_type || workout.sport_type || 'lift'
}

function getWorkoutWindow(date, workout) {
  const durationMin = Number(workout.duration_min) || 0
  const startMs = parseWorkoutStart(date, workout.time)
  if (!startMs || durationMin <= 0) return null
  return { startMs, endMs: startMs + (durationMin * 60_000), durationMin }
}

function pairLooksLikeConflict(date, left, right) {
  const leftWindow = getWorkoutWindow(date, left)
  const rightWindow = getWorkoutWindow(date, right)
  const leftType = normalizeWorkoutType(left)
  const rightType = normalizeWorkoutType(right)
  const sameType = leftType === rightType

  if (leftWindow && rightWindow) {
    const overlapMs = Math.min(leftWindow.endMs, rightWindow.endMs) - Math.max(leftWindow.startMs, rightWindow.startMs)
    const shortestMs = Math.min(leftWindow.durationMin, rightWindow.durationMin) * 60_000
    const startGapMs = Math.abs(leftWindow.startMs - rightWindow.startMs)
    const durationGap = Math.abs(leftWindow.durationMin - rightWindow.durationMin)
    const durationAvg = (leftWindow.durationMin + rightWindow.durationMin) / 2

    if (overlapMs > 0 && shortestMs > 0 && overlapMs / shortestMs >= 0.5) return true
    if (overlapMs > 20 * 60_000 && sameType) return true
    if (startGapMs <= 45 * 60_000 && durationGap <= Math.max(10, Math.round(durationAvg * 0.35)) && sameType) return true

    // If both have specific times and didn't meet overlap criteria, they are not a conflict
    return false
  }

  const leftDuration = Number(left.duration_min) || 0
  const rightDuration = Number(right.duration_min) || 0
  if (!leftDuration || !rightDuration) return false

  const diff = Math.abs(leftDuration - rightDuration)
  const avg = (leftDuration + rightDuration) / 2
  return sameType && (diff <= 10 || (avg > 0 && diff / avg <= 0.35))
}

function chooseConflictWinner(workouts, preferredSource) {
  const preferred = workouts.filter(w => (w.source || 'manual') === preferredSource)
  const pool = preferred.length ? preferred : workouts

  return [...pool].sort((a, b) => {
    const aDur = Number(a.duration_min) || 0
    const bDur = Number(b.duration_min) || 0
    if (bDur !== aDur) return bDur - aDur

    const aStart = parseWorkoutStart(a.date, a.time) || 0
    const bStart = parseWorkoutStart(b.date, b.time) || 0
    if (aStart !== bStart) return aStart - bStart

    return String(a.external_id || a.id || '').localeCompare(String(b.external_id || b.id || ''))
  })[0]
}

function resolveWorkoutConflicts(workoutsByDate) {
  const overrides = readConflictOverrides()
  const dismissals = readConflictDismissals()
  const defaultPreference = getWorkoutConflictPreference()
  const conflictGroups = {}

  for (const [date, workouts] of Object.entries(workoutsByDate)) {
    const eligible = workouts
      .map((workout, index) => ({ workout, index }))
      .filter(({ workout }) => {
        const src = workout.source || 'manual'
        return CONFLICT_INTEGRATIONS.has(src) && Number(workout.duration_min) > 0
      })

    if (eligible.length < 2) continue

    const parent = eligible.map((_, index) => index)
    const find = (index) => parent[index] === index ? index : (parent[index] = find(parent[index]))
    const union = (left, right) => {
      const rootLeft = find(left)
      const rootRight = find(right)
      if (rootLeft !== rootRight) parent[rootRight] = rootLeft
    }

    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const left = eligible[i].workout
        const right = eligible[j].workout
        // Same source entries from integrations can't conflict with each other,
        // but manual entries can conflict with anything including other manual ones
        const leftSrc = left.source || 'manual'
        const rightSrc = right.source || 'manual'
        if (leftSrc === rightSrc && leftSrc !== 'manual') continue
        if (pairLooksLikeConflict(date, left, right)) union(i, j)
      }
    }

    const components = new Map()
    eligible.forEach((entry, index) => {
      const root = find(index)
      if (!components.has(root)) components.set(root, [])
      components.get(root).push(entry.workout)
    })

    for (const component of components.values()) {
      if (component.length < 2) continue

      const groupId = `${date}|${component
        .map(w => `${w.source || 'manual'}:${w.external_id || w.id || w.time || w.description || ''}`)
        .sort()
        .join('|')}`

      // Skip dismissed groups but mark them so UI can allow re-flagging
      if (dismissals[groupId]) {
        for (const workout of component) {
          workout.dismissedConflictGroupId = groupId
        }
        continue
      }

      const sources = [...new Set(component.map(w => w.source || 'manual'))]
      const preferredSource = overrides[groupId] || defaultPreference
      const active = chooseConflictWinner(component, preferredSource)

      conflictGroups[groupId] = {
        date,
        sources,
        preferredSource,
        activeSource: active.source || 'manual',
        activeId: active.id,
      }

      for (const workout of component) {
        workout.conflictGroupId = groupId
        workout.conflictPreferredSource = preferredSource
        workout.conflictActiveSource = active.source || 'manual'
        workout.conflictSources = sources
        workout.isDuplicate = workout.id !== active.id
      }
    }
  }

  state.workoutConflictGroups = conflictGroups
}

export function getWorkoutConflictPreference() {
  const pref = localStorage.getItem(CONFLICT_PREFERENCE_KEY)
  return pref === 'google-health' ? 'google-health' : 'strava'
}

export function setWorkoutConflictPreference(source) {
  localStorage.setItem(CONFLICT_PREFERENCE_KEY, source === 'google-health' ? 'google-health' : 'strava')
}

export function setWorkoutConflictOverride(groupId, source) {
  const overrides = readConflictOverrides()
  overrides[groupId] = source
  writeConflictOverrides(overrides)
}

export function clearWorkoutConflictOverride(groupId) {
  const overrides = readConflictOverrides()
  if (!overrides[groupId]) return
  delete overrides[groupId]
  writeConflictOverrides(overrides)
}

export function dismissWorkoutConflict(groupId) {
  const dismissals = readConflictDismissals()
  dismissals[groupId] = true
  writeConflictDismissals(dismissals)
}

export function reflagWorkoutConflict(groupId) {
  const dismissals = readConflictDismissals()
  if (dismissals[groupId]) {
    delete dismissals[groupId]
    writeConflictDismissals(dismissals)
  }
}

function markDuplicates(workoutsByDate) {
  for (const workouts of Object.values(workoutsByDate)) {
    const strava = workouts.filter(w => w.source === 'strava' && w.duration_min)
    if (!strava.length) continue
    for (const w of workouts) {
      if (w.source !== 'google-health' || !w.duration_min) continue
      const isDup = strava.some(s => {
        const diff = Math.abs(s.duration_min - w.duration_min)
        const avg = (s.duration_min + w.duration_min) / 2
        return diff / avg < 0.25 || diff <= 5
      })
      if (isDup) w.isDuplicate = true
    }
  }
}

export const db = {
  async load() {
    // No user → return empty immediately (no DB call, no error)
    if (!state.currentUser) {
      state.workoutConflictGroups = {}
      return { food: {}, workouts: {}, weights: [] }
    }

    // Safari backgrounds freeze the auto-refresh timer; when the tab comes back
    // the token may be expired. Check and refresh before querying so we get a
    // real error (or null user) rather than silent empty arrays from RLS.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000))) {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data?.session) {
        state.currentUser = null
        state.dbCache = null
        return { food: {}, workouts: {}, weights: [] }
      }
      state.currentUser = data.session.user
    }

    const [
      { data: foodRows, error: e1 },
      { data: workoutRows, error: e2 },
      { data: weightRows, error: e3 },
    ] = await Promise.all([
      supabase.from('food_entries').select('*'),
      supabase.from('workout_entries').select('*'),
      supabase.from('weight_entries').select('*').order('date', { ascending: false }),
    ])

    const loadErr = e1 || e2 || e3
    if (loadErr) throw new Error(`DB load: ${loadErr.message}`)

    const food = {}
    for (const r of foodRows || []) {
      const { user_id, created_at, date, ...entry } = r
      food[date] = [...(food[date] || []), entry]
    }
    const workouts = {}
    for (const r of workoutRows || []) {
      const { user_id, created_at, date, ...entry } = r
      workouts[date] = [...(workouts[date] || []), entry]
    }
    resolveWorkoutConflicts(workouts)
    const weights = (weightRows || []).map(({ id, user_id, created_at, ...r }) => r)

    state.dbCache = { food, workouts, weights }
    return state.dbCache
  },

  bust() { state.dbCache = null },

  async addFood(date, entry) {
    const { error } = await supabase.from('food_entries').insert({ user_id: state.currentUser.id, date, ...entry })
    if (error) throw error
    this.bust()
  },

  async updateFood(id, entry) {
    const { error } = await supabase.from('food_entries').update(entry).eq('id', id)
    if (error) throw error
    this.bust()
  },

  async deleteFood(id) {
    const { error } = await supabase.from('food_entries').delete().eq('id', id)
    if (error) throw error
    this.bust()
  },

  async addWorkout(date, entry) {
    const { error } = await supabase.from('workout_entries').insert({ user_id: state.currentUser.id, date, ...entry })
    if (error) throw error
    this.bust()
  },

  async updateWorkout(id, entry) {
    const { error } = await supabase.from('workout_entries').update(entry).eq('id', id)
    if (error) throw error
    this.bust()
  },

  async deleteWorkout(id) {
    const { error } = await supabase.from('workout_entries').delete().eq('id', id)
    if (error) throw error
    this.bust()
  },

  async upsertWeight(entry) {
    const { error } = await supabase.from('weight_entries')
      .upsert({ user_id: state.currentUser.id, date: entry.date, kg: entry.kg }, { onConflict: 'user_id,date' })
    if (error) throw error
    this.bust()
  },

  async updateWeight(date, kg) {
    const { error } = await supabase.from('weight_entries')
      .update({ kg }).eq('user_id', state.currentUser.id).eq('date', date)
    if (error) throw error
    this.bust()
  },

  async deleteWeight(date) {
    const { error } = await supabase.from('weight_entries').delete()
      .eq('user_id', state.currentUser.id).eq('date', date)
    if (error) throw error
    this.bust()
  },

  async loadMeals() {
    const { data, error } = await supabase.from('meal_presets').select('*').order('name')
    if (error) throw error
    return data || []
  },

  async addMeal(entry) {
    const { error } = await supabase.from('meal_presets').insert({ user_id: state.currentUser.id, ...entry })
    if (error) throw error
  },

  async updateMeal(id, entry) {
    const { error } = await supabase.from('meal_presets').update(entry).eq('id', id)
    if (error) throw error
  },

  async deleteMeal(id) {
    const { error } = await supabase.from('meal_presets').delete().eq('id', id)
    if (error) throw error
  },

  async loadWorkoutPresets() {
    const { data, error } = await supabase.from('workout_presets').select('*').order('name')
    if (error) throw error
    return data || []
  },

  async addWorkoutPreset(entry) {
    const { error } = await supabase.from('workout_presets').insert({ user_id: state.currentUser.id, ...entry })
    if (error) throw error
  },

  async updateWorkoutPreset(id, entry) {
    const { error } = await supabase.from('workout_presets').update(entry).eq('id', id)
    if (error) throw error
  },

  async deleteWorkoutPreset(id) {
    const { error } = await supabase.from('workout_presets').delete().eq('id', id)
    if (error) throw error
  },

  async deleteStravaWorkouts() {
    const { error } = await supabase.from('workout_entries')
      .delete()
      .eq('user_id', state.currentUser.id)
      .eq('source', 'strava')
    if (error) throw error
    this.bust()
  },

  async getStravaIds(ids) {
    if (!ids.length) return []
    const { data, error } = await supabase
      .from('workout_entries')
      .select('external_id')
      .eq('user_id', state.currentUser.id)
      .eq('source', 'strava')
      .in('external_id', ids)
    if (error) throw error
    return (data || []).map(r => r.external_id)
  },

  async getGoogleHealthIds(ids) {
    if (!ids.length) return []
    const { data, error } = await supabase
      .from('workout_entries').select('external_id')
      .eq('user_id', state.currentUser.id).eq('source', 'google-health').in('external_id', ids)
    if (error) throw error
    return (data || []).map(r => r.external_id)
  },

  async deleteGoogleHealthWorkouts() {
    const { error } = await supabase.from('workout_entries').delete()
      .eq('user_id', state.currentUser.id).eq('source', 'google-health')
    if (error) throw error
    this.bust()
  },

  async insertWorkouts(rows) {
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50).map(r => ({ user_id: state.currentUser.id, ...r }))
      const { error } = await supabase.from('workout_entries').insert(chunk)
      if (error) throw error
    }
    this.bust()
  },

  async loadSettings() {
    const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
    if (error) throw error
    return data  // null if no row yet
  },

  async saveSettings(s) {
    const current = await this.loadSettings().catch(() => null)
    const { error } = await supabase.from('user_settings').upsert({
      user_id: state.currentUser.id,
      cal_rest: s.cal_rest ?? current?.cal_rest ?? null,
      cal_training: s.cal_training ?? current?.cal_training ?? null,
      protein_g: s.protein_g ?? current?.protein_g ?? null,
      carbs_g: s.carbs_g ?? current?.carbs_g ?? null,
      fat_g: s.fat_g ?? current?.fat_g ?? null,
      age_years: s.age_years ?? current?.age_years ?? null,
      sex: s.sex ?? current?.sex ?? null,
      height_cm: s.height_cm ?? current?.height_cm ?? null,
      weight_kg: s.weight_kg ?? current?.weight_kg ?? null,
      activity_level: s.activity_level ?? current?.activity_level ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
  },

  async getIntegration(provider) {
    if (!state.currentUser) return null
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', state.currentUser.id)
      .eq('provider', provider)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async upsertIntegration(provider, tokens) {
    if (!state.currentUser) return
    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: state.currentUser.id,
        provider,
        ...tokens,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' })
    if (error) throw error
  },

  async deleteIntegration(provider) {
    if (!state.currentUser) return
    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', state.currentUser.id)
      .eq('provider', provider)
    if (error) throw error
  },
}

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
import { state } from './state.js'

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function markDuplicates(workoutsByDate) {
  for (const workouts of Object.values(workoutsByDate)) {
    const strava = workouts.filter(w => w.source === 'strava' && w.duration_min)
    if (!strava.length) continue
    for (const w of workouts) {
      if (w.source !== 'google-health' || !w.duration_min) continue
      const isDup = strava.some(s => {
        const diff = Math.abs(s.duration_min - w.duration_min)
        const avg  = (s.duration_min + w.duration_min) / 2
        return diff / avg < 0.25 || diff <= 5
      })
      if (isDup) w.isDuplicate = true
    }
  }
}

export const db = {
  async load() {
    // No user → return empty immediately (no DB call, no error)
    if (!state.currentUser) return { food: {}, workouts: {}, weights: [] }

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
      { data: foodRows,    error: e1 },
      { data: workoutRows, error: e2 },
      { data: weightRows,  error: e3 },
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
    markDuplicates(workouts)
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
    const { error } = await supabase.from('user_settings').upsert({
      user_id:      state.currentUser.id,
      cal_rest:     s.cal_rest,
      cal_training: s.cal_training,
      protein_g:    s.protein_g,
      carbs_g:      s.carbs_g,
      fat_g:        s.fat_g,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
  },
}

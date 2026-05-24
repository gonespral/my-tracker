import { materialIcon } from './icons.js'
import * as env from './env.js'

export const SUPABASE_URL = env.SUPABASE_URL
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY
export const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`

// Default Client IDs for centralized OAuth (leave empty if using custom credentials exclusively)
export const STRAVA_CLIENT_ID = env.STRAVA_CLIENT_ID
export const GOOGLE_HEALTH_CLIENT_ID = env.GOOGLE_HEALTH_CLIENT_ID

export const TARGETS = {
  calories: { rest: 2150, bmr: 1800 },
  protein: 120,
  carbs: 240,
  fat: 65,
}

export const CALORIE_SEX = {
  female: { label: 'Female', offset: -161 },
  male: { label: 'Male', offset: 5 },
  other: { label: 'Other / prefer not to say', offset: 0 },
}

export const CALORIE_ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary', factor: 1.2, detail: 'Little to no movement' },
  light: { label: 'Light', factor: 1.375, detail: 'Light daily movement' },
  moderate: { label: 'Moderate', factor: 1.55, detail: 'Typical day with regular movement' },
  active: { label: 'Active', factor: 1.725, detail: 'High movement or frequent training' },
  very_active: { label: 'Very active', factor: 1.9, detail: 'Very active job or training volume' },
}

export const CALORIE_PROFILE_DEFAULTS = {
  sex: 'other',
  age: '',
  height_cm: '',
  weight_kg: '',
  activity_level: 'moderate',
}

export function computeCalorieTargets(profile, fallbackWeightKg = null) {
  const age = Number(profile?.age)
  const heightCm = Number(profile?.height_cm)
  const weightKg = Number(profile?.weight_kg || fallbackWeightKg)
  if (!age || !heightCm || !weightKg) return null

  const sexKey = CALORIE_SEX[profile?.sex] ? profile.sex : 'other'
  const activityKey = CALORIE_ACTIVITY_LEVELS[profile?.activity_level] ? profile.activity_level : 'moderate'
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + CALORIE_SEX[sexKey].offset
  const rest = Math.round(bmr * CALORIE_ACTIVITY_LEVELS[activityKey].factor)

  return {
    sex: sexKey,
    activity_level: activityKey,
    age,
    height_cm: heightCm,
    weight_kg: weightKg,
    bmr: Math.round(bmr),
    rest,
  }
}

export function hydrateCalorieTargets(profile, fallbackWeightKg = null) {
  const targets = computeCalorieTargets(profile, fallbackWeightKg)
  if (!targets) return null

  TARGETS.calories.rest = targets.rest
  TARGETS.calories.bmr = targets.bmr
  return targets
}

export const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner']

export const MEAL_ICON = {
  breakfast: materialIcon('breakfast_dining', 12),
  lunch: materialIcon('lunch_dining', 12),
  snack: materialIcon('cookie', 12),
  dinner: materialIcon('dinner_dining', 12),
  uncategorised: materialIcon('circle', 12),
}

export const MEAL_LABEL = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
  dinner: 'Dinner', uncategorised: 'Other',
}

export const INTENSITY_ICON = {
  low: materialIcon('signal_cellular_alt_1_bar', 11),
  medium: materialIcon('signal_cellular_alt', 11),
  high: materialIcon('trending_up', 11, { weight: 500 }),
}

export const ACTIVITY_TYPE = {
  run: { icon: materialIcon('directions_run', 16), label: 'Running', color: '#3b82f6' },
  cycle: { icon: materialIcon('directions_bike', 16), label: 'Cycling', color: '#10b981' },
  swim: { icon: materialIcon('pool', 16), label: 'Swimming', color: '#06b6d4' },
  walk: { icon: materialIcon('directions_walk', 16), label: 'Walking', color: '#84cc16' },
  yoga: { icon: materialIcon('self_improvement', 16), label: 'Yoga', color: '#a855f7' },
  hiit: { icon: materialIcon('bolt', 16), label: 'HIIT', color: '#f59e0b' },
  tennis: { icon: materialIcon('sports_tennis', 16), label: 'Tennis', color: '#eab308' },
  climb: { icon: materialIcon('hiking', 16), label: 'Climbing', color: '#ef4444' },
  row: { icon: materialIcon('rowing', 16), label: 'Rowing', color: '#0ea5e9' },
  ball: { icon: materialIcon('sports_soccer', 16), label: 'Ball sport', color: '#22c55e' },
  box: { icon: materialIcon('sports_martial_arts', 16), label: 'Martial arts', color: '#dc2626' },
  lift: { icon: materialIcon('fitness_center', 16), label: 'Lifting', color: '#f97316' },
}

export function detectActivityType(desc) {
  const d = (desc || '').toLowerCase()
  if (/run|jog|sprint|\b5k\b|\b10k\b|marathon|tempo/.test(d)) return 'run'
  if (/cycl|bike|biking|velodrome|\bride\b|mtb/.test(d)) return 'cycle'
  if (/swim|pool|\blap\b/.test(d)) return 'swim'
  if (/\bwalk|hike|hiking|trail/.test(d)) return 'walk'
  if (/yoga|pilates|stretch|meditation|flexib/.test(d)) return 'yoga'
  if (/hiit|circuit|crossfit|tabata|\bcardio\b/.test(d)) return 'hiit'
  if (/tennis|padel|squash|badminton|racqu|racket/.test(d)) return 'tennis'
  if (/climb|boulder/.test(d)) return 'climb'
  if (/\brow|rowing|kayak|canoe/.test(d)) return 'row'
  if (/football|soccer|basketball|rugby|volley|hockey/.test(d)) return 'ball'
  if (/box|boxing|kickbox|muay|mma|karate|judo|wrestling|martial|combat|sparring|jiu.?jitsu|bjj|grappl/.test(d)) return 'box'
  return 'lift'
}

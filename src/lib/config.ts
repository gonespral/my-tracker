export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`

// Default Client IDs for centralized OAuth (leave empty if using custom credentials exclusively)
export const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID
export const GOOGLE_HEALTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_HEALTH_CLIENT_ID

export const TARGETS = {
  calories: { rest: 2150, bmr: 1800, deficit: 0, goal: 2150, eatback_pct: 50, eatback_enabled: true, training: 2150 },
  protein: 120,
  protein_per_kg: null as number | null, // null = fixed g mode; number = weight-based g/kg mode
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

export interface CalorieProfile {
  sex?: keyof typeof CALORIE_SEX
  age?: number | string
  height_cm?: number | string
  weight_kg?: number | string
  activity_level?: keyof typeof CALORIE_ACTIVITY_LEVELS
}

export function computeCalorieTargets(profile?: CalorieProfile, fallbackWeightKg: number | null = null) {
  const age = Number(profile?.age)
  const heightCm = Number(profile?.height_cm)
  const weightKg = Number(profile?.weight_kg || fallbackWeightKg)
  if (!age || !heightCm || !weightKg) return null

  const sexKey = profile?.sex && CALORIE_SEX[profile.sex] ? profile.sex : 'other'
  const activityKey = profile?.activity_level && CALORIE_ACTIVITY_LEVELS[profile.activity_level] ? profile.activity_level : 'moderate'
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

// 20% protein / 45% carbs / 35% fat split
export function recommendMacros(calories: number, weightKg: number | null = null) {
  const protein = weightKg && TARGETS.protein_per_kg
    ? Math.round(weightKg * TARGETS.protein_per_kg)
    : Math.round(calories * 0.20 / 4)
  return {
    protein,
    carbs: Math.round(calories * 0.45 / 4),
    fat: Math.round(calories * 0.35 / 9),
  }
}

export function hydrateCalorieTargets(profile?: CalorieProfile, fallbackWeightKg: number | null = null) {
  const targets = computeCalorieTargets(profile, fallbackWeightKg)
  if (!targets) return null

  TARGETS.calories.rest = targets.rest
  TARGETS.calories.bmr = targets.bmr
  TARGETS.calories.goal = Math.max(0, Math.round(TARGETS.calories.rest - (TARGETS.calories.deficit || 0)))
  return targets
}

export function setCalorieDeficit(deficitKcal = 0) {
  const deficit = Math.max(0, Math.round(Number(deficitKcal) || 0))
  TARGETS.calories.deficit = deficit
  TARGETS.calories.goal = Math.max(0, Math.round(TARGETS.calories.rest - deficit))
  return TARGETS.calories.goal
}

export function getCalorieGoal() {
  return TARGETS.calories.goal ?? TARGETS.calories.rest
}

export const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const

export const MEAL_ICON_NAME: Record<string, string> = {
  breakfast: 'breakfast_dining',
  lunch: 'lunch_dining',
  snack: 'cookie',
  dinner: 'dinner_dining',
  uncategorised: 'circle',
}

export const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
  dinner: 'Dinner', uncategorised: 'Other',
}

export const INTENSITY_ICON_NAME: Record<string, { name: string; weight?: number }> = {
  low: { name: 'signal_cellular_alt_1_bar' },
  medium: { name: 'signal_cellular_alt' },
  high: { name: 'trending_up', weight: 500 },
}

export const ACTIVITY_TYPE: Record<string, { iconName: string; label: string; color: string }> = {
  run: { iconName: 'directions_run', label: 'Running', color: '#3b82f6' },
  cycle: { iconName: 'directions_bike', label: 'Cycling', color: '#10b981' },
  swim: { iconName: 'pool', label: 'Swimming', color: '#06b6d4' },
  walk: { iconName: 'directions_walk', label: 'Walking', color: '#84cc16' },
  yoga: { iconName: 'self_improvement', label: 'Yoga', color: '#a855f7' },
  hiit: { iconName: 'bolt', label: 'HIIT', color: '#f59e0b' },
  tennis: { iconName: 'sports_tennis', label: 'Tennis', color: '#eab308' },
  climb: { iconName: 'mountain_flag', label: 'Climbing', color: '#ef4444' },
  row: { iconName: 'rowing', label: 'Rowing', color: '#0ea5e9' },
  ball: { iconName: 'sports_soccer', label: 'Ball sport', color: '#22c55e' },
  box: { iconName: 'sports_martial_arts', label: 'Martial arts', color: '#dc2626' },
  lift: { iconName: 'fitness_center', label: 'Lifting', color: '#f97316' },
}

export function detectActivityType(desc?: string): string {
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

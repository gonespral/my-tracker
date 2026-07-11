export interface FoodEntry {
  id?: string
  date?: string
  description?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  meal?: string
}

export interface WorkoutEntry {
  id?: string
  date?: string
  description?: string
  activity_type?: string
  sport_type?: string
  intensity?: string
  duration_min?: number
  distance_km?: number | null
  calories_burned?: number
  heart_rate_avg?: number
  time?: string
  source?: string
  external_id?: string
  isDuplicate?: boolean
  conflictGroupId?: string
  dismissedConflictGroupId?: string
  conflictSources?: string[]
}

export interface MealPreset {
  id: string
  name: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  meal?: string
}

export interface WorkoutPreset {
  id: string
  name: string
  intensity?: string
  activity_type?: string
  calories_burned?: number | null
  duration_min?: number | null
  distance_km?: number | null
  heart_rate_avg?: number | null
}

export const dateStr = (d?: Date) => {
  d = d || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d)
}

export const nowTime = () => {
  const d = new Date(), h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

export const formatTimeToAMPM = (val?: string | Date | null) => {
  if (!val) return nowTime()
  let d: Date
  if (val instanceof Date) {
    d = val
  } else if (typeof val === 'string') {
    if (/^\d{1,2}:\d{2}\s*[ap]m$/i.test(val.trim())) return val.trim().toLowerCase()

    d = new Date(val)
    if (isNaN(d.getTime())) {
      const tMatch = val.match(/[T\s]?(\d{1,2}):(\d{2})/)
      if (tMatch) {
        const h = Number(tMatch[1]), m = Number(tMatch[2])
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
      }
      return nowTime()
    }
  } else {
    d = new Date(val)
  }
  if (isNaN(d.getTime())) return nowTime()
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

export const toUTCISO = (dateStr?: string, timeStr?: string) => {
  if (timeStr && timeStr.includes('T')) {
    const d = new Date(timeStr)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  const d = new Date()
  if (dateStr && timeStr) {
    let hours: number | undefined, minutes: number | undefined
    const matchAMPM = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i)
    if (matchAMPM) {
      hours = Number(matchAMPM[1]) % 12
      if (matchAMPM[3].toLowerCase() === 'pm') hours += 12
      minutes = Number(matchAMPM[2])
    } else {
      const match24 = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/)
      if (match24) {
        hours = Number(match24[1])
        minutes = Number(match24[2])
      }
    }
    if (hours !== undefined) {
      const [year, month, day] = dateStr.split('-').map(Number)
      d.setFullYear(year, month - 1, day)
      d.setHours(hours, minutes ?? 0, 0, 0)
    }
  }
  return d.toISOString()
}

export const formatTimeTo24H = (val?: string | null) => {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// All calories_burned values are stored as active calories (resting/BMR component already
// removed at import time for Strava; Google Health and manual entries are active by nature).
export const calculateNetActiveCalories = (workouts?: WorkoutEntry[]) => {
  if (!workouts || !workouts.length) return 0
  const total = workouts.reduce((sum, w) => {
    if (w.isDuplicate) return sum
    return sum + (w.calories_burned || 0)
  }, 0)
  return Math.round(total)
}

// Total (active + resting) calories for the activity duration, mirroring the
// per-item active/total split already shown on each workout card. Pass the
// user's BMR (kcal/day) so resting burn during the activity can be added back.
export const calculateTotalActivityCalories = (workouts?: WorkoutEntry[], bmr = 1800) => {
  if (!workouts || !workouts.length) return 0
  const bmrPerMin = bmr / 1440
  const total = workouts.reduce((sum, w) => {
    if (w.isDuplicate) return sum
    const active = w.calories_burned || 0
    const resting = w.duration_min ? bmrPerMin * w.duration_min : 0
    return sum + active + resting
  }, 0)
  return Math.round(total)
}

interface FoodTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export const sumFood = (entries: FoodEntry[]) => entries.reduce<FoodTotals>(
  (a, e) => ({
    calories: a.calories + (e.calories || 0), protein: a.protein + (e.protein || 0),
    carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0)
  }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 }
)

export const fmt = (n: unknown) => Math.round(+(n as number) || 0)
export const round = (n: unknown) => Math.round(+(n as number) || 0)
export const cap = (s?: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

export const fmtDate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export const fmtDateShort = (str: string) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Returns a Set of date strings where calorie intake looks like a missed-logging day.
// Uses IQR lower fence on the past nDays (excluding today) so the threshold adapts
// to the user's real eating pattern. Returns empty set if not enough data.
export function detectFoodOutliers(data: { food: Record<string, FoodEntry[]> }, nDays = 90): Set<string> {
  const calsByDate: Record<string, number> = {}
  const allCals: number[] = []
  for (let i = 1; i <= nDays; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    if (!food.length) continue
    const cals = sumFood(food).calories
    if (cals <= 0) continue
    calsByDate[ds] = cals
    allCals.push(cals)
  }
  if (allCals.length < 7) return new Set()
  const sorted = [...allCals].sort((a, b) => a - b)
  const n = sorted.length
  const q1 = sorted[Math.floor(n * 0.25)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  if (lowerFence < 200) return new Set() // distribution too tight/low to detect meaningfully
  const outliers = new Set<string>()
  for (const [ds, cals] of Object.entries(calsByDate)) {
    if (cals < lowerFence) outliers.add(ds)
  }
  return outliers
}

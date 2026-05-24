import { materialIcon } from './icons.js'

export const SUPABASE_URL      = "https://xtxizzxaivhitahfhuil.supabase.co"
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eGl6enhhaXZoaXRhaGZodWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDQwMjQsImV4cCI6MjA5NDg4MDAyNH0.IKN0Nf2sjHWJgfbC9qChN3-EiIN_yyGlCAwXgck3W0o"

export const TARGETS = {
  calories: { rest: 2150, training: 2350 },
  protein:  120,
  carbs:    240,
  fat:      65,
}

export const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner']

export const MEAL_ICON = {
  breakfast:     materialIcon('breakfast_dining', 12),
  lunch:         materialIcon('lunch_dining', 12),
  snack:         materialIcon('cookie', 12),
  dinner:        materialIcon('dinner_dining', 12),
  uncategorised: materialIcon('circle', 12),
}

export const MEAL_LABEL = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
  dinner: 'Dinner', uncategorised: 'Other',
}

export const INTENSITY_ICON = {
  low:    materialIcon('signal_cellular_alt_1_bar', 11),
  medium: materialIcon('signal_cellular_alt', 11),
  high:   materialIcon('trending_up', 11, { weight: 500 }),
}

export const ACTIVITY_TYPE = {
  run:    { icon: materialIcon('directions_run', 16), label: 'Running',    color: '#3b82f6' },
  cycle:  { icon: materialIcon('directions_bike', 16), label: 'Cycling',    color: '#10b981' },
  swim:   { icon: materialIcon('pool', 16), label: 'Swimming',   color: '#06b6d4' },
  walk:   { icon: materialIcon('directions_walk', 16), label: 'Walking',    color: '#84cc16' },
  yoga:   { icon: materialIcon('self_improvement', 16), label: 'Yoga',       color: '#a855f7' },
  hiit:   { icon: materialIcon('bolt', 16), label: 'HIIT',       color: '#f59e0b' },
  tennis: { icon: materialIcon('sports_tennis', 16), label: 'Tennis',     color: '#eab308' },
  climb:  { icon: materialIcon('hiking', 16), label: 'Climbing',   color: '#ef4444' },
  row:    { icon: materialIcon('rowing', 16), label: 'Rowing',     color: '#0ea5e9' },
  ball:   { icon: materialIcon('sports_soccer', 16), label: 'Ball sport', color: '#22c55e' },
  box:    { icon: materialIcon('sports_martial_arts', 16), label: 'Martial arts', color: '#dc2626' },
  lift:   { icon: materialIcon('fitness_center', 16), label: 'Lifting',   color: '#f97316' },
}

export function detectActivityType(desc) {
  const d = (desc || '').toLowerCase()
  if (/run|jog|sprint|\b5k\b|\b10k\b|marathon|tempo/.test(d))              return 'run'
  if (/cycl|bike|biking|velodrome|\bride\b|mtb/.test(d))                    return 'cycle'
  if (/swim|pool|\blap\b/.test(d))                                           return 'swim'
  if (/\bwalk|hike|hiking|trail/.test(d))                                    return 'walk'
  if (/yoga|pilates|stretch|meditation|flexib/.test(d))                      return 'yoga'
  if (/hiit|circuit|crossfit|tabata|\bcardio\b/.test(d))                     return 'hiit'
  if (/tennis|padel|squash|badminton|racqu|racket/.test(d))                  return 'tennis'
  if (/climb|boulder/.test(d))                                               return 'climb'
  if (/\brow|rowing|kayak|canoe/.test(d))                                    return 'row'
  if (/football|soccer|basketball|rugby|volley|hockey/.test(d))              return 'ball'
  if (/box|boxing|kickbox|muay|mma|jiu.?jitsu|bjj|karate|judo|wrestling|martial|combat|sparring|grappl/.test(d)) return 'box'
  return 'lift'
}

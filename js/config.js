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
  breakfast:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  lunch:         `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  snack:         `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  dinner:        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  uncategorised: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/></svg>`,
}

export const MEAL_LABEL = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
  dinner: 'Dinner', uncategorised: 'Other',
}

export const INTENSITY_ICON = {
  low:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-1px"><path d="M18 8a6 6 0 0 1-6 6 6 6 0 0 1-6-6"/><line x1="12" y1="14" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>`,
  medium: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`,
  high:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
}

export const ACTIVITY_TYPE = {
  run:    { emoji: '🏃', label: 'Running',    color: '#3b82f6' },
  cycle:  { emoji: '🚴', label: 'Cycling',    color: '#10b981' },
  swim:   { emoji: '🏊', label: 'Swimming',   color: '#06b6d4' },
  walk:   { emoji: '🚶', label: 'Walking',    color: '#84cc16' },
  yoga:   { emoji: '🧘', label: 'Yoga',       color: '#a855f7' },
  hiit:   { emoji: '⚡', label: 'HIIT',       color: '#f59e0b' },
  tennis: { emoji: '🎾', label: 'Tennis',     color: '#eab308' },
  climb:  { emoji: '🧗', label: 'Climbing',   color: '#ef4444' },
  row:    { emoji: '🚣', label: 'Rowing',     color: '#0ea5e9' },
  ball:   { emoji: '⚽', label: 'Ball sport', color: '#22c55e' },
  box:    { emoji: '🥊', label: 'Boxing',     color: '#dc2626' },
  lift:   { emoji: '🏋️', label: 'Lifting',   color: '#f97316' },
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
  if (/box|boxing|kickbox|muay|mma|jiu.?jitsu|karate|judo|wrestling/.test(d)) return 'box'
  return 'lift'
}

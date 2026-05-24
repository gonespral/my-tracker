import { MEAL_ORDER, MEAL_ICON, MEAL_LABEL, INTENSITY_ICON, ACTIVITY_TYPE, detectActivityType } from './config.js'
import { fmt, round, cap } from './utils.js'

const FOOD_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`

// Sport-type icons — matched by keyword from workout description
const _I = `width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
const ICON_LIFT    = `<svg ${_I}><path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4M6 9h12M6 15h12"/></svg>`
const ICON_RUN     = `<svg ${_I}><circle cx="13" cy="4" r="2"/><path d="M7.5 22L12 14l3 3 3.5-6.5"/><path d="M17 9.5l-3-2.5-4 3 2 2"/></svg>`
const ICON_CYCLE   = `<svg ${_I}><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17L9 7h6l3.5 10"/><path d="M9 7l9.5 10"/></svg>`
const ICON_SWIM    = `<svg ${_I}><path d="M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M2 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><circle cx="13" cy="5" r="1.5"/><path d="M13 6.5l-2.5 3-2-1.5"/></svg>`
const ICON_WALK    = `<svg ${_I}><circle cx="12" cy="3" r="2"/><path d="M10 8l-3 8 5-2 3 7"/><path d="M10 8l4 4"/></svg>`
const ICON_YOGA    = `<svg ${_I}><circle cx="12" cy="3" r="2"/><path d="M12 5v4"/><path d="M8 9l4 2 4-2"/><path d="M8 9l-1 5h10l-1-5"/></svg>`
const ICON_HIIT    = `<svg ${_I} stroke-width="2.2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
const ICON_RACQUET = `<svg ${_I}><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="21" y2="21"/><path d="M3.5 10a6.5 6.5 0 0 1 13 0"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13"/></svg>`
const ICON_CLIMB   = `<svg ${_I}><path d="M3 20L12 4l9 16H3z"/></svg>`
const ICON_ROW     = `<svg ${_I}><path d="M2 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M5 9l7-5 7 5"/><path d="M12 4v5"/></svg>`
const ICON_BALL    = `<svg ${_I}><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"/><path d="M2 12h20"/></svg>`

const TYPE_TO_ICON = { run: ICON_RUN, cycle: ICON_CYCLE, swim: ICON_SWIM, walk: ICON_WALK,
  yoga: ICON_YOGA, hiit: ICON_HIIT, tennis: ICON_RACQUET, climb: ICON_CLIMB,
  row: ICON_ROW, ball: ICON_BALL, lift: ICON_LIFT }

function workoutTypeIcon(desc) {
  const type = detectActivityType(desc)
  return TYPE_TO_ICON[type]
    || (ACTIVITY_TYPE[type] ? `<span style="font-size:16px">${ACTIVITY_TYPE[type].emoji}</span>` : ICON_LIFT)
}

// Strava sport_type → emoji (for Strava-synced entries)
const SPORT_EMOJI = {
  Swim: '🏊', Ride: '🚴', VirtualRide: '🚴', EBikeRide: '🚴',
  GravelRide: '🚴', MountainBikeRide: '🚴', EMountainBikeRide: '🚴',
  Run: '🏃', VirtualRun: '🏃', TrailRun: '🏃',
  Walk: '🚶', Hike: '🥞', Rowing: '🚣',
  WeightTraining: '🏋️', Crossfit: '🏋️', Yoga: '🧘', Pilates: '🧘',
}

// date param is passed so edit/delete actions know which day the entry belongs to
export const foodItem = (e, date) => `
  <div class="log-item">
    <div class="log-icon">${FOOD_SVG}</div>
    <div class="log-body">
      <div class="log-desc">${e.description}</div>
      <div class="log-tags">
        ${e.protein ? `<span class="tag">P ${fmt(e.protein)}g</span>` : ''}
        ${e.carbs   ? `<span class="tag">C ${fmt(e.carbs)}g</span>`   : ''}
        ${e.fat     ? `<span class="tag">F ${fmt(e.fat)}g</span>`     : ''}
      </div>
    </div>
    <div class="log-right">
      <div class="log-cal">${round(e.calories)}</div>
      <div class="log-cal-unit">kcal</div>
    </div>
    <div class="entry-menu-wrap">
      <button class="entry-menu-btn" data-action="toggle-menu">⋮</button>
      <div class="entry-menu">
        <button data-action="edit-food" data-id="${e.id}" data-date="${date}">Edit</button>
        <button data-action="save-to-meals" data-id="${e.id}" data-date="${date}">Save to meals</button>
        <button class="danger" data-action="delete-food" data-id="${e.id}">Delete</button>
      </div>
    </div>
  </div>`

export const workoutItem = (e, date) => {
  const icon = INTENSITY_ICON[e.intensity] || INTENSITY_ICON.medium
  const logIcon = e.activity_type
    ? (TYPE_TO_ICON[e.activity_type] || (ACTIVITY_TYPE[e.activity_type] ? `<span style="font-size:16px">${ACTIVITY_TYPE[e.activity_type].emoji}</span>` : ICON_LIFT))
    : e.sport_type && SPORT_EMOJI[e.sport_type]
      ? `<span style="font-size:16px">${SPORT_EMOJI[e.sport_type]}</span>`
      : workoutTypeIcon(e.description)

  let distanceTag = ''
  if (e.distance) {
    const km = e.distance / 1000
    distanceTag = `<span class="tag">${km >= 1 ? km.toFixed(1) + ' km' : Math.round(e.distance) + ' m'}</span>`
  }

  const isStrava    = e.source === 'strava'
  const isGoogleHealth = e.source === 'google-health'
  const isImported     = isStrava || isGoogleHealth
  const stravaBadge    = isStrava
    ? `<a class="tag tag-strava" href="https://www.strava.com/activities/${e.external_id}" target="_blank" rel="noopener" style="text-decoration:none">Strava ↗</a>`
    : ''
  const googleHealthBadge = isGoogleHealth ? `<span class="tag tag-google-health">Google Health</span>` : ''

  return `
    <div class="log-item">
      <div class="log-icon">${logIcon}</div>
      <div class="log-body">
        <div class="log-desc">${e.description || '—'}</div>
        <div class="log-tags">
          <span class="tag intensity-${e.intensity}">${icon} ${cap(e.intensity)}</span>
          ${e.calories_burned ? `<span class="tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ${e.calories_burned} kcal</span>` : ''}
          ${e.duration_min ? `<span class="tag">⏱ ${e.duration_min} min</span>` : (e.duration ? `<span class="tag">⏱ ${e.duration}</span>` : '')}
          ${e.distance_km  ? `<span class="tag">📍 ${e.distance_km} km</span>`  : distanceTag}
          ${e.heart_rate_avg ? `<span class="tag">❤️ ${e.heart_rate_avg} bpm</span>` : ''}
          ${stravaBadge}
          ${googleHealthBadge}
        </div>
      </div>
      ${!isImported ? `
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">⋮</button>
        <div class="entry-menu">
          <button data-action="edit-workout" data-id="${e.id}" data-date="${date}">Edit</button>
          <button class="danger" data-action="delete-workout" data-id="${e.id}">Delete</button>
        </div>
      </div>` : ''}
    </div>`
}

export function foodByMeal(food, date) {
  const groups = {}
  for (const e of food) {
    const m = e.meal || 'uncategorised'
    ;(groups[m] = groups[m] || []).push(e)
  }
  return [...MEAL_ORDER, 'uncategorised']
    .filter(m => groups[m]?.length)
    .map(m => `
      <div class="meal-section">
        <div class="meal-section-hd">${MEAL_ICON[m] || ''} ${MEAL_LABEL[m] || m}</div>
        ${groups[m].map(e => foodItem(e, date)).join('')}
      </div>`)
    .join('')
}

import { MEAL_ORDER, MEAL_ICON, MEAL_LABEL, INTENSITY_ICON, detectActivityType } from './config.js'
import { fmt, round, cap } from './utils.js'
import { typeIcon, SPORT_TYPE_MAP } from './icons.js'
import { state } from './state.js'

const FOOD_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`

const ICON_CLOCK = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
const ICON_PIN   = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
const ICON_HEART = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
const ICON_FLAME = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`

function workoutTypeIcon(desc) {
  return typeIcon(detectActivityType(desc))
}

function isPresetEntry(desc) {
  const meals = state.mealsCache || []
  const norm = s => (s || '').toLowerCase().trim()
  const d = norm(desc)
  return meals.some(m => norm(m.name) === d)
}

// date param is passed so edit/delete actions know which day the entry belongs to
export const foodItem = (e, date) => {
  const fromPreset = isPresetEntry(e.description)
  return `
  <div class="log-item">
    <div class="log-icon">${FOOD_SVG}</div>
    <div class="log-body">
      <div class="log-desc">${e.description}</div>
      <div class="log-tags">
        ${e.protein ? `<span class="tag">P ${fmt(e.protein)}g</span>` : ''}
        ${e.carbs   ? `<span class="tag">C ${fmt(e.carbs)}g</span>`   : ''}
        ${e.fat     ? `<span class="tag">F ${fmt(e.fat)}g</span>`     : ''}
        ${fromPreset ? `<span class="tag tag-saved">Saved</span>` : ''}
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
}

export const workoutItem = (e, date) => {
  const intensityIcon = INTENSITY_ICON[e.intensity] || INTENSITY_ICON.medium

  // Resolve icon: explicit activity_type > Strava sport_type > detect from description
  const logIcon = e.activity_type
    ? typeIcon(e.activity_type)
    : e.sport_type
      ? typeIcon(SPORT_TYPE_MAP[e.sport_type] || detectActivityType(e.description))
      : workoutTypeIcon(e.description)

  let distanceTag = ''
  if (e.distance) {
    const km = e.distance / 1000
    distanceTag = `<span class="tag">${ICON_PIN} ${km >= 1 ? km.toFixed(1) + ' km' : Math.round(e.distance) + ' m'}</span>`
  }

  const isStrava       = e.source === 'strava'
  const isGoogleHealth = e.source === 'google-health'
  const isImported     = isStrava || isGoogleHealth
  const isDuplicate    = e.isDuplicate === true
  const stravaBadge    = isStrava
    ? `<a class="tag tag-strava" href="https://www.strava.com/activities/${e.external_id}" target="_blank" rel="noopener" style="text-decoration:none">Strava ↗</a>`
    : ''
  const googleHealthBadge = isGoogleHealth ? `<span class="tag tag-google-health">Google Health</span>` : ''
  const dupBadge = isDuplicate ? `<span class="tag tag-duplicate">Duplicate</span>` : ''

  return `
    <div class="log-item${isDuplicate ? ' log-item-duplicate' : ''}">
      <div class="log-icon">${logIcon}</div>
      <div class="log-body">
        <div class="log-desc">${e.description || '—'}</div>
        <div class="log-tags">
          <span class="tag intensity-${e.intensity}">${intensityIcon} ${cap(e.intensity)}</span>
          ${e.calories_burned ? `<span class="tag">${ICON_FLAME} ${e.calories_burned} kcal</span>` : ''}
          ${e.duration_min ? `<span class="tag">${ICON_CLOCK} ${e.duration_min} min</span>` : (e.duration ? `<span class="tag">${ICON_CLOCK} ${e.duration}</span>` : '')}
          ${e.distance_km  ? `<span class="tag">${ICON_PIN} ${e.distance_km} km</span>`  : distanceTag}
          ${e.heart_rate_avg ? `<span class="tag">${ICON_HEART} ${e.heart_rate_avg} bpm</span>` : ''}
          ${stravaBadge}
          ${googleHealthBadge}
          ${dupBadge}
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

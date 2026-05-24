import { MEAL_ORDER, MEAL_ICON, MEAL_LABEL, INTENSITY_ICON, detectActivityType } from './config.js'
import { fmt, round, cap, formatTimeToAMPM } from './utils.js'
import { typeIcon, SPORT_TYPE_MAP, materialIcon } from './icons.js'
import { state } from './state.js'

const FOOD_ICON = materialIcon('restaurant', 15)

const ICON_CLOCK = materialIcon('schedule', 10, { style: 'vertical-align:-1px' })
const ICON_PIN   = materialIcon('location_on', 10, { style: 'vertical-align:-1px' })
const ICON_HEART = materialIcon('favorite', 10, { style: 'vertical-align:-1px' })
const ICON_FLAME = materialIcon('local_fire_department', 10, { style: 'vertical-align:-1px' })

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
    <div class="log-icon">${FOOD_ICON}</div>
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
      <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
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
    distanceTag = `<span class="tag">${ICON_PIN} ${km >= 1 ? km.toFixed(2) + ' km' : (e.distance || 0).toFixed(2) + ' m'}</span>`
  }

  const isStrava       = e.source === 'strava'
  const isGoogleHealth = e.source === 'google-health' || e.source === 'fitbit'
  const isImported     = isStrava || isGoogleHealth
  const isDuplicate    = e.isDuplicate === true
  const inConflict     = !!e.conflictGroupId
  const isDismissed    = !!e.dismissedConflictGroupId
  const duplicateBadge = isDuplicate ? `<span class="tag tag-duplicate">Duplicate</span>` : ''
  const stravaBadge    = isStrava
    ? `<a class="tag tag-strava" href="https://www.strava.com/activities/${e.external_id}" target="_blank" rel="noopener" style="text-decoration:none">Strava ↗</a>`
    : ''
  const googleHealthBadge = e.source === 'fitbit'
    ? `<span class="tag tag-google-health">Fitbit</span>`
    : (e.source === 'google-health' ? `<span class="tag tag-google-health">Google Health</span>` : '')

  // Build three-dot menu items
  const menuItems = []
  if (!isImported) {
    menuItems.push(`<button data-action="edit-workout" data-id="${e.id}" data-date="${date}">Edit</button>`)
  }
  if (inConflict && isDuplicate) {
    menuItems.push(`<button data-action="activate-workout-conflict" data-group="${e.conflictGroupId}" data-source="${e.source || 'manual'}" data-id="${e.id}">Count this instead</button>`)
  }
  if (inConflict) {
    menuItems.push(`<button data-action="unflag-workout-conflict" data-group="${e.conflictGroupId}">Not a duplicate</button>`)
  }
  if (isDismissed) {
    menuItems.push(`<button data-action="reflag-workout-conflict" data-group="${e.dismissedConflictGroupId}">Flag as duplicate</button>`)
  }
  if (!isImported) {
    menuItems.push(`<button class="danger" data-action="delete-workout" data-id="${e.id}">Delete</button>`)
  }

  const hasMenu = menuItems.length > 0
  const menuHTML = hasMenu ? `
      <div class="entry-menu-wrap">
        <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
        <div class="entry-menu">
          ${menuItems.join('')}
        </div>
      </div>` : ''

  return `
    <div class="log-item${isDuplicate ? ' log-item-duplicate' : ''}">
      <div class="log-icon">${logIcon}</div>
      <div class="log-body">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:2px;">
          <div class="log-desc">${e.description || '—'}</div>
          ${e.time ? `<div style="font-size:12px; color:var(--tx3); white-space:nowrap;">${formatTimeToAMPM(e.time)}</div>` : ''}
        </div>
        <div class="log-tags">
          <span class="tag intensity-${e.intensity}">${intensityIcon} ${cap(e.intensity)}</span>
          ${duplicateBadge}
          ${e.calories_burned ? `<span class="tag">${ICON_FLAME} ${e.calories_burned} kcal</span>` : ''}
          ${e.duration_min ? `<span class="tag">${ICON_CLOCK} ${e.duration_min} min</span>` : ''}
          ${e.distance_km  ? `<span class="tag">${ICON_PIN} ${e.distance_km} km</span>`  : ''}
          ${e.heart_rate_avg ? `<span class="tag">${ICON_HEART} ${e.heart_rate_avg} bpm</span>` : ''}
          ${stravaBadge}
          ${googleHealthBadge}
        </div>
      </div>
      ${menuHTML}
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

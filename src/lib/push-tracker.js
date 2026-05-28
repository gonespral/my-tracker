// Maps local DB entry ID → remote platform ID for activities pushed out from this app.
// Separate from `source` field which tracks where an activity *came from*.
const KEY_STRAVA = 'pushed-to-strava-map'
const KEY_GH     = 'pushed-to-gh-map'

function getMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') }
  catch { return {} }
}

function saveMap(key, map) {
  localStorage.setItem(key, JSON.stringify(map))
}

export function markPushedToStrava(localId, remoteId) {
  const m = getMap(KEY_STRAVA)
  m[String(localId)] = String(remoteId)
  saveMap(KEY_STRAVA, m)
}

export function markPushedToGH(localId, remoteId) {
  const m = getMap(KEY_GH)
  m[String(localId)] = String(remoteId)
  saveMap(KEY_GH, m)
}

export function clearPushedToStrava(localId) {
  const m = getMap(KEY_STRAVA)
  delete m[String(localId)]
  saveMap(KEY_STRAVA, m)
}

export function clearPushedToGH(localId) {
  const m = getMap(KEY_GH)
  delete m[String(localId)]
  saveMap(KEY_GH, m)
}

export const wasPushedToStrava = localId => String(localId) in getMap(KEY_STRAVA)
export const wasPushedToGH     = localId => String(localId) in getMap(KEY_GH)
export const pushedStravaId    = localId => getMap(KEY_STRAVA)[String(localId)] || null
export const pushedGHId        = localId => getMap(KEY_GH)[String(localId)] || null

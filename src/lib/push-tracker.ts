const KEY_STRAVA = 'pushed-to-strava-map'
const KEY_GH = 'pushed-to-gh-map'

function getMap(key: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') }
  catch { return {} }
}

function saveMap(key: string, map: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(map))
}

export function markPushedToStrava(localId: string, remoteId: string) {
  const m = getMap(KEY_STRAVA)
  m[String(localId)] = String(remoteId)
  saveMap(KEY_STRAVA, m)
}

export function markPushedToGH(localId: string, remoteId: string) {
  const m = getMap(KEY_GH)
  m[String(localId)] = String(remoteId)
  saveMap(KEY_GH, m)
}

export function clearPushedToStrava(localId: string) {
  const m = getMap(KEY_STRAVA)
  delete m[String(localId)]
  saveMap(KEY_STRAVA, m)
}

export function clearPushedToGH(localId: string) {
  const m = getMap(KEY_GH)
  delete m[String(localId)]
  saveMap(KEY_GH, m)
}

export const wasPushedToStrava = (localId: string) => String(localId) in getMap(KEY_STRAVA)
export const wasPushedToGH = (localId: string) => String(localId) in getMap(KEY_GH)
export const pushedStravaId = (localId: string) => getMap(KEY_STRAVA)[String(localId)] || null
export const pushedGHId = (localId: string) => getMap(KEY_GH)[String(localId)] || null

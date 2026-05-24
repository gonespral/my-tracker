import { state } from './state.js'
import { db } from './db.js'
import { dateStr, nowTime } from './utils.js'
import { showToast } from './ui.js'

// ── Exercise type → sport_type mapping ───────────────────────────────────

const GOOGLE_SPORT_MAP = {
  WALKING:          'Walk',
  RUNNING:          'Run',
  JOGGING:          'Run',
  BIKING:           'Ride',
  CYCLING:          'Ride',
  MOUNTAIN_BIKING:  'MountainBikeRide',
  SWIMMING:         'Swim',
  HIKING:           'Hike',
  ROWING:           'Rowing',
  WEIGHT_TRAINING:  'WeightTraining',
  YOGA:             'Yoga',
  PILATES:          'Pilates',
  CROSSFIT:         'Crossfit',
  ELLIPTICAL:       'WeightTraining',
  ROCK_CLIMBING:    'Hike',
  CROSS_TRAINING:   'WeightTraining',
}

// Human-readable fallback labels
const GOOGLE_TYPE_LABEL = {
  WALKING: 'Walk', RUNNING: 'Run', JOGGING: 'Jog', BIKING: 'Bike ride',
  CYCLING: 'Cycling', MOUNTAIN_BIKING: 'Mountain bike', SWIMMING: 'Swim',
  HIKING: 'Hike', ROWING: 'Rowing', WEIGHT_TRAINING: 'Weight training',
  YOGA: 'Yoga', PILATES: 'Pilates', CROSSFIT: 'CrossFit',
  ELLIPTICAL: 'Elliptical', ROCK_CLIMBING: 'Rock climbing',
}

// ── Token helpers ──────────────────────────────────────────────────

export function googleHealthIsConnected() {
  return !!localStorage.getItem('google-health-refresh-token')
}

function getCredentials() {
  return {
    clientId:     localStorage.getItem('google-health-client-id')     || '',
    clientSecret: localStorage.getItem('google-health-client-secret') || '',
  }
}

function clearTokens() {
  ['google-health-access-token', 'google-health-refresh-token',
   'google-health-expires-at', 'google-health-last-sync'].forEach(k => localStorage.removeItem(k))
}

async function refreshIfNeeded() {
  const expiresAt = parseInt(localStorage.getItem('google-health-expires-at') || '0')
  if (Date.now() < expiresAt - 60_000) return

  const { clientId, clientSecret } = getCredentials()
  const refreshToken = localStorage.getItem('google-health-refresh-token')
  if (!refreshToken) throw new Error('Google Health not connected')

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error('Token refresh failed: ' + res.status)
  const data = await res.json()
  localStorage.setItem('google-health-access-token', data.access_token)
  localStorage.setItem('google-health-expires-at', String(Date.now() + data.expires_in * 1000))
  // Google only issues a new refresh_token when rotating — keep existing if absent
  if (data.refresh_token) localStorage.setItem('google-health-refresh-token', data.refresh_token)
}

// ── OAuth callback ──────────────────────────────────────────────────

export async function handleGoogleHealthCallback() {
  const params = new URLSearchParams(location.search)
  if (params.get('state') !== 'google-health-oauth') return

  const code     = params.get('code')
  const { clientId, clientSecret } = getCredentials()
  const redirect  = location.origin + location.pathname

  history.replaceState(null, '', location.pathname + location.hash)

  if (!code || !clientId || !clientSecret) {
    showToast('❌ Google Health auth failed — check credentials')
    return
  }

  try {
    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      client_id:    clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error_description || err.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    localStorage.setItem('google-health-access-token',  data.access_token)
    localStorage.setItem('google-health-refresh-token', data.refresh_token)
    localStorage.setItem('google-health-expires-at',    String(Date.now() + data.expires_in * 1000))

    // Get display name from userinfo
    const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (uRes.ok) {
      const u = await uRes.json()
      const name = u.name || u.email || 'Google user'
      localStorage.setItem('google-health-user-name', name)
      showToast(`✅ Google Health connected as ${name}`)
    } else {
      showToast('✅ Google Health connected')
    }
  } catch (e) {
    showToast('❌ Google Health: ' + e.message)
  }
}

// ── Activity mapping ──────────────────────────────────────────────────

function mapDataPoint(dp) {
  const ex       = dp.exercise || {}
  const interval = ex.interval || {}
  const summary  = ex.metricsSummary || {}
  const type     = ex.exerciseType || ''

  const startTime = interval.startTime || ''
  const endTime   = interval.endTime   || ''
  const date      = startTime.slice(0, 10)

  const durationMs = startTime && endTime
    ? new Date(endTime) - new Date(startTime)
    : null
  const durationMin = durationMs ? Math.round(durationMs / 60000) : null

  const calories = summary.caloriesKcal || null

  // Distance: prefer meters, then km, then miles → convert to meters
  let distance = null
  if (summary.distanceM  != null) distance = Math.round(summary.distanceM)
  else if (summary.distanceKm != null) distance = Math.round(summary.distanceKm * 1000)
  else if (summary.distanceMi != null) distance = Math.round(summary.distanceMi * 1609.34)

  const intensity = calories > 400 ? 'high' : calories > 150 ? 'medium' : 'low'

  // Extract the unique point ID from the name field
  const pointId = (dp.name || '').split('/').pop() || String(Date.now())

  const description = GOOGLE_TYPE_LABEL[type] || (type ? type.replace(/_/g, ' ').toLowerCase() : 'Workout')

  return {
    description,
    sport_type:      GOOGLE_SPORT_MAP[type] || null,
    intensity,
    calories_burned: calories ? Math.round(calories) : null,
    duration_min:    durationMin,
    distance,
    source:          'google-health',
    external_id:     pointId,
    date,
    time:            nowTime(),
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────

export async function syncGoogleHealth({ silent = false, onComplete = null } = {}) {
  if (!googleHealthIsConnected()) return
  if (!state.currentUser) return

  try {
    await refreshIfNeeded()
  } catch (e) {
    clearTokens()
    updateGoogleHealthSettingsSection()
    showToast('❌ Google Health token expired — please reconnect')
    return
  }

  const token     = localStorage.getItem('google-health-access-token')
  const afterDate = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return dateStr(d) })()
  const filterStr = `exercise.interval.civil_start_time >= "${afterDate}T00:00:00"`

  let allPoints = []
  let pageToken  = null
  try {
    do {
      const url = new URL('https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints')
      url.searchParams.set('filter', filterStr)
      url.searchParams.set('pageSize', '200')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) {
        clearTokens()
        updateGoogleHealthSettingsSection()
        showToast('❌ Google Health token expired — please reconnect')
        return
      }
      if (!res.ok) throw new Error(`Google Health API ${res.status}`)
      const data = await res.json()
      allPoints = allPoints.concat(data.dataPoints || [])
      pageToken  = data.nextPageToken || null
    } while (pageToken)
  } catch (e) {
    if (!silent) showToast('❌ Google Health sync: ' + e.message)
    return
  }

  try {
    const allIds    = allPoints.map(dp => (dp.name || '').split('/').pop()).filter(Boolean)
    const existing  = await db.getGoogleHealthIds(allIds)
    const existingSet = new Set(existing)

    const toInsert = allPoints
      .filter(dp => {
        const id = (dp.name || '').split('/').pop()
        return id && !existingSet.has(id)
      })
      .map(mapDataPoint)
      .filter(e => e.date)

    if (toInsert.length > 0) await db.insertWorkouts(toInsert)

    localStorage.setItem('google-health-last-sync', String(Date.now()))
    updateGoogleHealthSettingsSection()
    onComplete?.()

    if (!silent) showToast(`✅ Google Health: ${toInsert.length} new activit${toInsert.length !== 1 ? 'ies' : 'y'} added`)
  } catch (e) {
    if (!silent) showToast('❌ Google Health sync: ' + e.message)
  }
}

// ── Connect / Disconnect ──────────────────────────────────────────────────

export function connectGoogleHealth() {
  const clientId     = document.getElementById('gh-cid-input')?.value.trim()
  const clientSecret = document.getElementById('gh-csecret-input')?.value.trim()
  if (!clientId)     { document.getElementById('gh-cid-input')?.focus();     return }
  if (!clientSecret) { document.getElementById('gh-csecret-input')?.focus(); return }

  localStorage.setItem('google-health-client-id',     clientId)
  localStorage.setItem('google-health-client-secret', clientSecret)

  const redirect = location.origin + location.pathname
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('redirect_uri',  redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope',         'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly')
  url.searchParams.set('access_type',   'offline')
  url.searchParams.set('prompt',        'consent')
  url.searchParams.set('state',         'google-health-oauth')
  location.href = url.toString()
}

export function disconnectGoogleHealth() {
  clearTokens()
  updateGoogleHealthSettingsSection()
  showToast('Google Health disconnected')
}

// ── Settings section updater ───────────────────────────────────────────────

export function updateGoogleHealthSettingsSection() {
  const disconnected = document.getElementById('gh-disconnected-ui')
  const connected    = document.getElementById('gh-connected-ui')
  if (!disconnected || !connected) return

  const isConnected = googleHealthIsConnected()
  disconnected.style.display = isConnected ? 'none' : ''
  connected.style.display    = isConnected ? '' : 'none'

  if (isConnected) {
    const name     = localStorage.getItem('google-health-user-name') || 'Connected'
    const lastSync = parseInt(localStorage.getItem('google-health-last-sync') || '0')
    document.getElementById('gh-user-label').textContent = name
    document.getElementById('gh-last-sync-label').textContent =
      lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : 'Last synced: never'
    const cidInput = document.getElementById('gh-cid-input')
    if (cidInput) cidInput.value = getCredentials().clientId
  }
}

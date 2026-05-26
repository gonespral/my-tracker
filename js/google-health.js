import { state } from './state.js'
import { db, supabase, parseWorkoutStart } from './db.js'
import { dateStr, nowTime } from './utils.js'
import { showToast } from './ui.js'
import { GOOGLE_HEALTH_CLIENT_ID as DEFAULT_CLIENT_ID, EDGE_FUNCTION_URL } from './config.js'
import { stravaAutoPushGoogleEnabled, stravaIsConnected, pushActivityToStrava } from './strava.js'

const GH_CUSTOM_FLAG = 'google-health-use-custom'
const GH_CLIENT_ID = 'google-health-client-id'
const GH_CLIENT_SECRET = 'google-health-client-secret'
const GH_ACCESS_TOKEN = 'google-health-access-token'
const GH_REFRESH_TOKEN = 'google-health-refresh-token'
const GH_EXPIRES_AT = 'google-health-expires-at'
const GH_USER_NAME = 'google-health-user-name'
const GH_LAST_SYNC = 'google-health-last-sync'
const GH_CONNECTED = 'google-health-connected'

export const googleHealthUsesCustom = () => localStorage.getItem(GH_CUSTOM_FLAG) === 'true'
export const googleHealthCustomId = () => localStorage.getItem(GH_CLIENT_ID) || ''
export const googleHealthCustomSecret = () => localStorage.getItem(GH_CLIENT_SECRET) || ''
export const googleHealthClientId = () => googleHealthUsesCustom() ? googleHealthCustomId() : DEFAULT_CLIENT_ID

export const ghAutoPushEnabled = () => localStorage.getItem('google-health-auto-push') === '1'
export const ghSyncPaused = () => localStorage.getItem('google-health-sync-paused') === '1'
export const ghPushStravaImports = () => localStorage.getItem('gh-push-strava') === '1'

export function googleHealthIsConnected() {
  if (googleHealthUsesCustom()) return !!localStorage.getItem(GH_REFRESH_TOKEN)
  return localStorage.getItem(GH_CONNECTED) === 'true'
}

// Only values confirmed valid for write by the Google Health API v4
const ACTIVITY_TYPE_TO_GH = {
  run:    'RUNNING',
  walk:   'WALKING',
  cycle:  'BIKING',
  swim:   'SWIMMING',
  row:    'ROWING',
  yoga:   'YOGA',
  lift:   'STRENGTH_TRAINING',
  hiit:   'HIIT',
  climb:  'ROCK_CLIMBING',
  box:    'WORKOUT',
  tennis: 'WORKOUT',
  ball:   'WORKOUT',
}

// Strava sport_type → Google Health exercise type
const SPORT_TYPE_TO_GH = {
  Run:              'RUNNING',
  Walk:             'WALKING',
  Hike:             'HIKING',
  Ride:             'BIKING',
  MountainBikeRide: 'BIKING',
  Swim:             'SWIMMING',
  Rowing:           'ROWING',
  Yoga:             'YOGA',
  Pilates:          'PILATES',
  WeightTraining:   'STRENGTH_TRAINING',
  Crossfit:         'HIIT',
  Elliptical:       'WORKOUT',
  RockClimbing:     'ROCK_CLIMBING',
}

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

const GOOGLE_TYPE_LABEL = {
  WALKING: 'Walk', RUNNING: 'Run', JOGGING: 'Jog', BIKING: 'Bike ride',
  CYCLING: 'Cycling', MOUNTAIN_BIKING: 'Mountain bike', SWIMMING: 'Swim',
  HIKING: 'Hike', ROWING: 'Rowing', WEIGHT_TRAINING: 'Weight training',
  YOGA: 'Yoga', PILATES: 'Pilates', CROSSFIT: 'CrossFit',
  ELLIPTICAL: 'Elliptical', ROCK_CLIMBING: 'Rock climbing',
}

export function updateGoogleHealthSettingsSection() {
  const disconnected = document.getElementById('gh-disconnected-ui')
  const connected    = document.getElementById('gh-connected-ui')
  if (!disconnected || !connected) return

  const isConnected = googleHealthIsConnected()
  disconnected.style.display = isConnected ? 'none' : ''
  connected.style.display    = isConnected ? '' : 'none'

  if (isConnected) {
    const name     = localStorage.getItem(GH_USER_NAME) || 'Connected'
    const lastSync = parseInt(localStorage.getItem(GH_LAST_SYNC) || '0')
    const lbl = document.getElementById('gh-user-label')
    if (lbl) lbl.textContent = name
    const syncLbl = document.getElementById('gh-last-sync-label')
    if (syncLbl) syncLbl.textContent = lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : 'Last synced: never'
  } else {
    const customCb = document.getElementById('gh-custom-cb')
    if (customCb) customCb.checked = googleHealthUsesCustom()
    const customFields = document.getElementById('gh-custom-fields')
    if (customFields) customFields.style.display = googleHealthUsesCustom() ? 'block' : 'none'

    const cidInput = document.getElementById('gh-cid-input')
    if (cidInput) cidInput.value = googleHealthCustomId()
    const csecInput = document.getElementById('gh-csecret-input')
    if (csecInput) csecInput.value = googleHealthCustomSecret()
  }
}

export async function handleGoogleHealthCallback() {
  const params = new URLSearchParams(location.search)
  if (params.get('state') !== 'google-health-oauth') return

  const code     = params.get('code')
  const redirect  = location.origin + location.pathname

  history.replaceState(null, '', location.pathname + location.hash)

  if (!code) {
    const error = params.get('error')
    const desc  = params.get('error_description')
    if (error) showToast(`❌ Google Health: ${desc || error}`)
    return
  }

  showToast('🔄 Connecting Google Health…')

  try {
    if (googleHealthUsesCustom()) {
      const clientId     = googleHealthCustomId()
      const clientSecret = googleHealthCustomSecret()
      if (!clientId || !clientSecret) throw new Error('Missing custom credentials')

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
      localStorage.setItem(GH_ACCESS_TOKEN,  data.access_token)
      if (data.refresh_token) localStorage.setItem(GH_REFRESH_TOKEN, data.refresh_token)
      localStorage.setItem(GH_EXPIRES_AT,    String(Date.now() + data.expires_in * 1000))

      const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      let name = 'Google user'
      if (uRes.ok) {
        const u = await uRes.json()
        name = u.name || u.email || name
      }
      localStorage.setItem(GH_USER_NAME, name)
      showToast(`✅ Google Health connected as ${name}`)

    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${EDGE_FUNCTION_URL}/google-health-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'exchange', code, redirectUri: redirect }),
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `Exchange failed (${resp.status})`)
      }
      const data = await resp.json()
      if (data.error) throw new Error(data.error)

      localStorage.setItem(GH_CONNECTED, 'true')
      if (data.displayName) localStorage.setItem(GH_USER_NAME, data.displayName)
      showToast(`✅ Google Health connected${data.displayName ? ' as ' + data.displayName : ''}`)
    }
  } catch (e) {
    console.error('Google Health OAuth error:', e)
    showToast('❌ Google Health: ' + e.message)
  }
}

async function getValidAccessToken() {
  if (googleHealthUsesCustom()) {
    const expiresAt = parseInt(localStorage.getItem(GH_EXPIRES_AT) || '0')
    if (Date.now() < expiresAt - 60_000) return localStorage.getItem(GH_ACCESS_TOKEN)

    const clientId     = googleHealthCustomId()
    const clientSecret = googleHealthCustomSecret()
    const refreshToken = localStorage.getItem(GH_REFRESH_TOKEN)
    if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing credentials')

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
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        disconnectGoogleHealth(true)
        throw new Error('Session expired')
      }
      throw new Error(`Token refresh failed (${res.status})`)
    }
    const data = await res.json()
    localStorage.setItem(GH_ACCESS_TOKEN, data.access_token)
    localStorage.setItem(GH_EXPIRES_AT, String(Date.now() + data.expires_in * 1000))
    if (data.refresh_token) localStorage.setItem(GH_REFRESH_TOKEN, data.refresh_token)
    return data.access_token
  } else {
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(`${EDGE_FUNCTION_URL}/google-health-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'refresh' }),
    })
    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 401) {
        disconnectGoogleHealth(true)
        throw new Error('Session expired')
      }
      throw new Error(`Refresh failed (${resp.status})`)
    }
    const data = await resp.json()
    if (data.error) throw new Error(data.error)
    return data.accessToken
  }
}

function mapDataPoint(dp) {
  const ex       = dp.exercise || {}
  const interval = ex.interval || {}
  const summary  = ex.metricsSummary || {}
  const type     = ex.exerciseType || ''

  const startTime = interval.startTime || ''
  const endTime   = interval.endTime   || ''
  const date      = startTime.slice(0, 10)

  const durationMs = startTime && endTime ? new Date(endTime) - new Date(startTime) : null
  const durationMin = durationMs ? Math.round(durationMs / 60000) : null

  const calories = summary.caloriesKcal || null

  let distanceKm = null
  if (summary.distanceKm != null) distanceKm = summary.distanceKm
  else if (summary.distanceM  != null) distanceKm = summary.distanceM / 1000
  else if (summary.distanceMi != null) distanceKm = summary.distanceMi * 1.60934
  if (distanceKm != null) distanceKm = parseFloat(distanceKm.toFixed(1))

  const intensity = calories > 400 ? 'high' : calories > 150 ? 'medium' : 'low'
  const pointId = (dp.name || '').split('/').pop() || String(Date.now())
  const description = GOOGLE_TYPE_LABEL[type] || (type ? type.replace(/_/g, ' ').toLowerCase() : 'Workout')

  return {
    description,
    sport_type:      GOOGLE_SPORT_MAP[type] || null,
    intensity,
    calories_burned: calories ? Math.round(calories) : null,
    duration_min:    durationMin,
    distance_km:     distanceKm,
    source:          'google-health',
    external_id:     pointId,
    date,
    time:            startTime || nowTime(),
  }
}

export async function syncGoogleHealth({ silent = false, onComplete = null } = {}) {
  if (!googleHealthIsConnected()) return
  if (!state.currentUser) return
  if (ghSyncPaused()) { if (!silent) showToast('⏸ Google Health sync is paused'); return }

  let token
  try {
    token = await getValidAccessToken()
  } catch (e) {
    if (!silent) showToast('❌ Google Health: ' + e.message)
    return
  }

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
        disconnectGoogleHealth(true)
        if (!silent) showToast('❌ Google Health session expired')
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

    if (toInsert.length > 0) {
      await db.insertWorkouts(toInsert)
      if (stravaAutoPushGoogleEnabled() && stravaIsConnected()) {
        for (const entry of toInsert) {
          pushActivityToStrava(entry).catch(err => console.warn('[Strava auto-push]', err.message || err))
        }
      }
    }

    localStorage.setItem(GH_LAST_SYNC, String(Date.now()))
    updateGoogleHealthSettingsSection()

    // Auto-recalibrate TDEE targets if user has opted in
    const settings = await db.loadSettings().catch(() => null)
    if (settings?.tdee_source === 'google-health') calibrateTDEETargets({ silent: true })

    onComplete?.()

    if (!silent) showToast(`✅ Google Health: ${toInsert.length} new activit${toInsert.length !== 1 ? 'ies' : 'y'} added`)
  } catch (e) {
    if (!silent) showToast('❌ Google Health sync: ' + e.message)
  }
}

export function connectGoogleHealth() {
  const isCustom = document.getElementById('gh-custom-cb')?.checked
  if (isCustom) {
    const clientId     = document.getElementById('gh-cid-input')?.value.trim()
    const clientSecret = document.getElementById('gh-csecret-input')?.value.trim()
    if (!clientId)     { document.getElementById('gh-cid-input')?.focus();     return }
    if (!clientSecret) { document.getElementById('gh-csecret-input')?.focus(); return }

    localStorage.setItem(GH_CUSTOM_FLAG, 'true')
    localStorage.setItem(GH_CLIENT_ID,     clientId)
    localStorage.setItem(GH_CLIENT_SECRET, clientSecret)
  } else {
    localStorage.removeItem(GH_CUSTOM_FLAG)
  }

  const clientId = googleHealthClientId()
  if (!clientId) {
    showToast('❌ Application Client ID is missing. Use custom credentials or configure config.js')
    return
  }

  const redirect = location.origin + location.pathname
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('redirect_uri',  redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope',         'https://www.googleapis.com/auth/googlehealth.activity_and_fitness https://www.googleapis.com/auth/googlehealth.activity_and_fitness_writeonly')
  url.searchParams.set('access_type',   'offline')
  url.searchParams.set('prompt',        'consent')
  url.searchParams.set('state',         'google-health-oauth')
  location.href = url.toString()
}

export async function pushActivityToGoogleHealth(entry) {
  if (!googleHealthIsConnected()) throw new Error('Google Health not connected')
  const token = await getValidAccessToken()
  const ghType = ACTIVITY_TYPE_TO_GH[entry.activity_type]
    ?? SPORT_TYPE_TO_GH[entry.sport_type]
    ?? 'WORKOUT'
  const startMs = parseWorkoutStart(entry.date, entry.time)
  const durationMs = (entry.duration_min ?? 0) * 60_000
  const startTime = new Date(startMs).toISOString()
  const endTime   = new Date(startMs + durationMs).toISOString()
  const metrics = {}
  if (entry.calories_burned) metrics.caloriesKcal = entry.calories_burned
  const body = {
    exercise: {
      interval: { startTime, endTime },
      exerciseType: ghType,
      ...(Object.keys(metrics).length ? { metricsSummary: metrics } : {}),
    }
  }
  // Log token scopes for diagnosing 403 scope errors
  fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token)
    .then(r => r.json()).then(info => console.log('[GH token scopes]', info.scope, 'exp:', info.exp))
    .catch(() => {})
  console.log('[GH push] body:', JSON.stringify(body, null, 2))

  const resp = await fetch(
    'https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  if (resp.status === 401) {
    disconnectGoogleHealth(true)
    throw new Error('Session expired — please reconnect Google Health')
  }
  if (resp.status === 403) {
    const errBody = await resp.json().catch(() => ({}))
    console.error('[GH push 403 full response]', JSON.stringify(errBody, null, 2))
    const status = errBody.error?.status || 'PERMISSION_DENIED'
    const msg = errBody.error?.message || status
    const details = errBody.error?.details?.map(d => d.reason || d.type).filter(Boolean).join(', ')
    throw new Error(`403 ${status}${details ? ` (${details})` : ''}: ${msg}`)
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Push failed (${resp.status})`)
  }
}

async function fetchDailyTDEE(token, days = 90) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  const resp = await fetch(
    'https://health.googleapis.com/v4/users/me/dataTypes/total-calories:dailyRollUp',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ startTime: start.toISOString(), endTime: end.toISOString() }),
    }
  )
  if (!resp.ok) throw new Error(`TDEE fetch failed (${resp.status})`)
  const data = await resp.json()
  // Normalise whatever shape the API returns into [{date, kcal}]
  const points = data.rollUps ?? data.dataPoints ?? data.rollups ?? []
  return points.map(p => {
    const raw = p.value ?? p.totalCalories?.value ?? p.calories?.value ?? p.caloriesKcal ?? null
    const kcal = raw != null ? parseFloat(raw) : null
    const ts = p.startTime ?? p.interval?.startTime ?? p.date ?? null
    const date = ts ? ts.slice(0, 10) : null
    return { date, kcal }
  }).filter(p => p.date && p.kcal != null && p.kcal > 800 && p.kcal < 8000)
}

export async function calibrateTDEETargets({ silent = false } = {}) {
  if (!googleHealthIsConnected()) return
  if (!state.currentUser) return
  let token
  try { token = await getValidAccessToken() } catch { return }

  let points
  try {
    points = await fetchDailyTDEE(token, 90)
  } catch (e) {
    if (!silent) showToast('❌ TDEE fetch: ' + e.message)
    return
  }

  if (points.length < 7) {
    if (!silent) showToast('Not enough Google Health data to calibrate (need at least 7 days)')
    return
  }

  // Load workout dates to split rest vs training days
  let workoutDates = new Set()
  try {
    const data = state.dbCache ?? await db.load()
    ;(data?.workouts ?? []).forEach(w => workoutDates.add(w.date))
  } catch { /* non-fatal */ }

  const restPoints     = points.filter(p => !workoutDates.has(p.date))
  const trainingPoints = points.filter(p =>  workoutDates.has(p.date))

  const avg = arr => arr.length ? Math.round(arr.reduce((s, p) => s + p.kcal, 0) / arr.length) : null

  const calRest     = avg(restPoints)
  const calTraining = trainingPoints.length >= 3 ? avg(trainingPoints) : null

  if (!calRest) {
    if (!silent) showToast('Not enough rest-day data to calibrate')
    return
  }

  try {
    await db.saveSettings({
      cal_rest:           calRest,
      cal_training:       calTraining ?? calRest,
      tdee_source:        'google-health',
      tdee_calibrated_at: new Date().toISOString(),
    })
    // Apply immediately
    const { TARGETS } = await import('./config.js')
    TARGETS.calories.rest     = calRest
    TARGETS.calories.training = calTraining ?? calRest
    if (!silent) showToast(`✅ Calorie targets updated from Google Health (rest ${calRest} kcal${calTraining ? `, training ${calTraining} kcal` : ''})`)
    updateGoogleHealthSettingsSection()
  } catch (e) {
    if (!silent) showToast('❌ Calibration save failed: ' + e.message)
  }
}

export async function disconnectGoogleHealth(silent = false) {
  localStorage.removeItem(GH_ACCESS_TOKEN)
  localStorage.removeItem(GH_REFRESH_TOKEN)
  localStorage.removeItem(GH_EXPIRES_AT)
  localStorage.removeItem(GH_USER_NAME)
  localStorage.removeItem(GH_LAST_SYNC)
  localStorage.removeItem(GH_CONNECTED)

  if (!googleHealthUsesCustom()) {
    try { await db.deleteIntegration('google-health') } catch(e) { console.error(e) }
  }

  updateGoogleHealthSettingsSection()
  if (!silent) showToast('Google Health disconnected')
}

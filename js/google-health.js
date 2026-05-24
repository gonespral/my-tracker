import { state } from './state.js'
import { db, supabase } from './db.js'
import { dateStr, nowTime } from './utils.js'
import { showToast } from './ui.js'
import { GOOGLE_HEALTH_CLIENT_ID as DEFAULT_CLIENT_ID, EDGE_FUNCTION_URL } from './config.js'

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

export function googleHealthIsConnected() {
  if (googleHealthUsesCustom()) return !!localStorage.getItem(GH_REFRESH_TOKEN)
  return localStorage.getItem(GH_CONNECTED) === 'true'
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

  if (!code) return

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

    if (toInsert.length > 0) await db.insertWorkouts(toInsert)

    localStorage.setItem(GH_LAST_SYNC, String(Date.now()))
    updateGoogleHealthSettingsSection()
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
  url.searchParams.set('scope',         'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly')
  url.searchParams.set('access_type',   'offline')
  url.searchParams.set('prompt',        'consent')
  url.searchParams.set('state',         'google-health-oauth')
  location.href = url.toString()
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

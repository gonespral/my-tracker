import { db, supabase, parseWorkoutStart } from './db'
import { dateStr, nowTime, type WorkoutEntry } from './utils'
import { useAppStore } from '../store'
import { showToast } from './toast'
import { startSync, endSync, failSync } from './sync-status'
import { GOOGLE_HEALTH_CLIENT_ID as DEFAULT_CLIENT_ID, EDGE_FUNCTION_URL, TARGETS } from './config'
import { stravaAutoPushGoogleEnabled, stravaIsConnected, pushActivityToStrava } from './strava'

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
export const googleHealthClientId = () => (googleHealthUsesCustom() ? googleHealthCustomId() : DEFAULT_CLIENT_ID)
export const googleHealthUserName = () => localStorage.getItem(GH_USER_NAME) || ''
export const googleHealthLastSync = () => Number(localStorage.getItem(GH_LAST_SYNC) || 0)

export const ghAutoPushEnabled = () => (useAppStore.getState().settings as { gh_auto_push?: boolean })?.gh_auto_push ?? (localStorage.getItem('google-health-auto-push') === '1')
export const ghSyncPaused = () => (useAppStore.getState().settings as { gh_sync_paused?: boolean })?.gh_sync_paused ?? (localStorage.getItem('google-health-sync-paused') === '1')
export const ghPushStravaImports = () => (useAppStore.getState().settings as { gh_push_strava?: boolean })?.gh_push_strava ?? (localStorage.getItem('gh-push-strava') === '1')

export function googleHealthIsConnected() {
  if (googleHealthUsesCustom()) return !!localStorage.getItem(GH_REFRESH_TOKEN)
  return localStorage.getItem(GH_CONNECTED) === 'true'
}

const ACTIVITY_TYPE_TO_GH: Record<string, string> = {
  run: 'RUNNING', walk: 'WALKING', cycle: 'BIKING', swim: 'SWIMMING', row: 'ROWING',
  yoga: 'YOGA', lift: 'STRENGTH_TRAINING', hiit: 'HIIT', climb: 'ROCK_CLIMBING',
  box: 'WORKOUT', tennis: 'WORKOUT', ball: 'WORKOUT',
}

const SPORT_TYPE_TO_GH: Record<string, string> = {
  Run: 'RUNNING', Walk: 'WALKING', Hike: 'HIKING', Ride: 'BIKING', MountainBikeRide: 'BIKING',
  Swim: 'SWIMMING', Rowing: 'ROWING', Yoga: 'YOGA', Pilates: 'PILATES',
  WeightTraining: 'STRENGTH_TRAINING', Crossfit: 'HIIT', Elliptical: 'WORKOUT', RockClimbing: 'ROCK_CLIMBING',
}

const GOOGLE_SPORT_MAP: Record<string, string> = {
  WALKING: 'Walk', RUNNING: 'Run', JOGGING: 'Run', BIKING: 'Ride', CYCLING: 'Ride',
  MOUNTAIN_BIKING: 'MountainBikeRide', SWIMMING: 'Swim', HIKING: 'Hike', ROWING: 'Rowing',
  WEIGHT_TRAINING: 'WeightTraining', YOGA: 'Yoga', PILATES: 'Pilates', CROSSFIT: 'Crossfit',
  ELLIPTICAL: 'WeightTraining', ROCK_CLIMBING: 'Hike', CROSS_TRAINING: 'WeightTraining',
}

const GOOGLE_TYPE_LABEL: Record<string, string> = {
  WALKING: 'Walk', RUNNING: 'Run', JOGGING: 'Jog', BIKING: 'Bike ride', CYCLING: 'Cycling',
  MOUNTAIN_BIKING: 'Mountain bike', SWIMMING: 'Swim', HIKING: 'Hike', ROWING: 'Rowing',
  WEIGHT_TRAINING: 'Weight training', YOGA: 'Yoga', PILATES: 'Pilates', CROSSFIT: 'CrossFit',
  ELLIPTICAL: 'Elliptical', ROCK_CLIMBING: 'Rock climbing',
}

export async function handleGoogleHealthCallback() {
  const params = new URLSearchParams(location.search)
  if (params.get('state') !== 'google-health-oauth') return

  const code = params.get('code')
  const redirect = location.origin + location.pathname
  history.replaceState(null, '', location.pathname + location.hash)

  if (!code) {
    const error = params.get('error')
    const desc = params.get('error_description')
    if (error) showToast(`Google Health: ${desc || error}`)
    return
  }

  showToast('Connecting Google Health…')

  try {
    if (googleHealthUsesCustom()) {
      const clientId = googleHealthCustomId()
      const clientSecret = googleHealthCustomSecret()
      if (!clientId || !clientSecret) throw new Error('Missing custom credentials')

      const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect })
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
      localStorage.setItem(GH_ACCESS_TOKEN, data.access_token)
      if (data.refresh_token) localStorage.setItem(GH_REFRESH_TOKEN, data.refresh_token)
      localStorage.setItem(GH_EXPIRES_AT, String(Date.now() + data.expires_in * 1000))

      const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${data.access_token}` } })
      let name = 'Google user'
      if (uRes.ok) {
        const u = await uRes.json()
        name = u.name || u.email || name
      }
      localStorage.setItem(GH_USER_NAME, name)
      showToast(`Google Health connected as ${name}`)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${EDGE_FUNCTION_URL}/google-health-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
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
      showToast(`Google Health connected${data.displayName ? ' as ' + data.displayName : ''}`)
    }
  } catch (e) {
    console.error('Google Health OAuth error:', e)
    showToast('Google Health: ' + (e as Error).message)
  }
}

async function getValidAccessToken(): Promise<string> {
  if (googleHealthUsesCustom()) {
    const expiresAt = parseInt(localStorage.getItem(GH_EXPIRES_AT) || '0')
    if (Date.now() < expiresAt - 60_000) return localStorage.getItem(GH_ACCESS_TOKEN)!

    const clientId = googleHealthCustomId()
    const clientSecret = googleHealthCustomSecret()
    const refreshToken = localStorage.getItem(GH_REFRESH_TOKEN)
    if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing credentials')

    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) { disconnectGoogleHealth(true); throw new Error('Session expired') }
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'refresh' }),
    })
    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 401) { disconnectGoogleHealth(true); throw new Error('Session expired') }
      throw new Error(`Refresh failed (${resp.status})`)
    }
    const data = await resp.json()
    if (data.error) throw new Error(data.error)
    return data.accessToken
  }
}

interface GHDataPoint {
  name?: string
  exercise?: {
    interval?: { startTime?: string; endTime?: string }
    metricsSummary?: { caloriesKcal?: number; distanceKm?: number; distanceM?: number; distanceMi?: number }
    exerciseType?: string
  }
}

function mapDataPoint(dp: GHDataPoint): WorkoutEntry & { date: string } {
  const ex = dp.exercise || {}
  const interval = ex.interval || {}
  const summary = ex.metricsSummary || {}
  const type = ex.exerciseType || ''

  const startTime = interval.startTime || ''
  const endTime = interval.endTime || ''
  const date = startTime.slice(0, 10)

  const durationMs = startTime && endTime ? new Date(endTime).getTime() - new Date(startTime).getTime() : null
  const durationMin = durationMs ? Math.round(durationMs / 60000) : undefined

  const calories = summary.caloriesKcal || null

  let distanceKm: number | null = null
  if (summary.distanceKm != null) distanceKm = summary.distanceKm
  else if (summary.distanceM != null) distanceKm = summary.distanceM / 1000
  else if (summary.distanceMi != null) distanceKm = summary.distanceMi * 1.60934
  if (distanceKm != null) distanceKm = parseFloat(distanceKm.toFixed(1))

  const intensity = calories && calories > 400 ? 'high' : calories && calories > 150 ? 'medium' : 'low'
  const pointId = (dp.name || '').split('/').pop() || String(Date.now())
  const description = GOOGLE_TYPE_LABEL[type] || (type ? type.replace(/_/g, ' ').toLowerCase() : 'Workout')

  return {
    description,
    sport_type: GOOGLE_SPORT_MAP[type] || undefined,
    intensity,
    calories_burned: calories ? Math.round(calories) : undefined,
    duration_min: durationMin,
    distance_km: distanceKm,
    source: 'google-health',
    external_id: pointId,
    date,
    time: startTime || nowTime(),
  }
}

let ghSyncInProgress = false

export async function syncGoogleHealth({ onComplete }: { onComplete?: () => void | Promise<void> } = {}) {
  if (!googleHealthIsConnected()) return
  if (!useAppStore.getState().currentUser) return
  if (ghSyncPaused()) return
  if (ghSyncInProgress) return
  ghSyncInProgress = true
  startSync('Google Health')

  let newCount = 0
  let syncFailed = false
  try {
    let token: string
    try {
      token = await getValidAccessToken()
    } catch (e) {
      console.error('Google Health token error:', e)
      syncFailed = true
      return
    }

    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return dateStr(d) })()

    let allPoints: GHDataPoint[] = []
    let pageToken: string | null = null
    try {
      do {
        const url = new URL('https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints')
        url.searchParams.set('pageSize', '200')
        if (pageToken) url.searchParams.set('pageToken', pageToken)

        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
        if (res.status === 401) { disconnectGoogleHealth(true); return }
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          const msg = errBody.error?.message || errBody.error?.status || `HTTP ${res.status}`
          throw new Error(`Google Health read: ${msg}`)
        }
        const data = await res.json()
        allPoints = allPoints.concat(data.dataPoints || [])
        pageToken = data.nextPageToken || null
      } while (pageToken)
    } catch (e) {
      console.error('Google Health sync error:', e)
      syncFailed = true
      return
    }

    try {
      allPoints = allPoints.filter((dp) => {
        const start = dp.exercise?.interval?.startTime || ''
        return start.slice(0, 10) >= cutoff
      })

      const allIds = allPoints.map((dp) => (dp.name || '').split('/').pop()).filter((id): id is string => !!id)
      const existing = await db.getGoogleHealthIds(allIds)
      const existingSet = new Set(existing)

      const toInsert = allPoints
        .filter((dp) => {
          const id = (dp.name || '').split('/').pop()
          return id && !existingSet.has(id)
        })
        .map(mapDataPoint)
        .filter((e) => e.date)

      if (toInsert.length > 0) {
        await db.insertWorkouts(toInsert)
        newCount = toInsert.length
        if (stravaAutoPushGoogleEnabled() && stravaIsConnected()) {
          for (const entry of toInsert) {
            pushActivityToStrava(entry).catch((err) => console.warn('[Strava auto-push]', err.message || err))
          }
        }
      }

      localStorage.setItem(GH_LAST_SYNC, String(Date.now()))
      await onComplete?.()
    } catch (e) {
      console.error('Google Health sync error:', e)
      syncFailed = true
    }
  } finally {
    ghSyncInProgress = false
    if (syncFailed) failSync('Google Health')
    else endSync('Google Health')
  }
  return newCount
}

export function connectGoogleHealth(custom?: { clientId: string; clientSecret: string }) {
  if (custom) {
    if (!custom.clientId || !custom.clientSecret) { showToast('Enter both Client ID and Client Secret'); return }
    localStorage.setItem(GH_CUSTOM_FLAG, 'true')
    localStorage.setItem(GH_CLIENT_ID, custom.clientId)
    localStorage.setItem(GH_CLIENT_SECRET, custom.clientSecret)
  } else {
    localStorage.removeItem(GH_CUSTOM_FLAG)
  }

  const clientId = googleHealthClientId()
  if (!clientId) { showToast('Application Client ID is missing. Use custom credentials or configure config.ts'); return }

  const redirect = location.origin + location.pathname
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.activity_and_fitness.writeonly')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', 'google-health-oauth')
  location.href = url.toString()
}

export async function pushActivityToGoogleHealth(entry: WorkoutEntry) {
  if (!googleHealthIsConnected()) throw new Error('Google Health not connected')
  const token = await getValidAccessToken()
  const ghType = ACTIVITY_TYPE_TO_GH[entry.activity_type || ''] ?? SPORT_TYPE_TO_GH[entry.sport_type || ''] ?? 'WORKOUT'
  const startMs = parseWorkoutStart(entry.date, entry.time)
  const durationMs = (entry.duration_min ?? 0) * 60_000
  const startTime = new Date(startMs!).toISOString()
  const endTime = new Date(startMs! + durationMs).toISOString()
  const metrics: { caloriesKcal?: number } = {}
  if (entry.calories_burned) metrics.caloriesKcal = entry.calories_burned
  const body = {
    exercise: {
      interval: { startTime, endTime },
      exerciseType: ghType,
      ...(Object.keys(metrics).length ? { metricsSummary: metrics } : {}),
    },
  }

  const resp = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (resp.status === 401) { disconnectGoogleHealth(true); throw new Error('Session expired — please reconnect Google Health') }
  if (resp.status === 403) {
    const errBody = await resp.json().catch(() => ({}))
    const msg = errBody.error?.message || errBody.error?.status || 'PERMISSION_DENIED'
    const details = errBody.error?.details?.map((d: unknown) => JSON.stringify(d)).join('; ') || ''
    throw new Error(`Push blocked (403): ${msg}${details ? ' — ' + details : ''}`)
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Push failed (${resp.status})`)
  }
  const created = await resp.json().catch(() => ({}))
  return created.name || null
}

export async function deleteActivityFromGoogleHealth(nameOrId: string) {
  if (!googleHealthIsConnected()) throw new Error('Google Health not connected')
  const token = await getValidAccessToken()
  const name = nameOrId?.startsWith('users/') ? nameOrId : `users/me/dataTypes/exercise/dataPoints/${nameOrId}`
  const resp = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints:batchDelete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ names: [name] }),
  })
  if (resp.status === 401) { disconnectGoogleHealth(true); throw new Error('Session expired — please reconnect Google Health') }
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}))
    throw new Error(errBody.error?.message || `GH delete failed (${resp.status})`)
  }
}

function estimateBMR(settings: { weight_kg?: number; height_cm?: number; age_years?: number; sex?: string } = {}) {
  const { weight_kg = 75, height_cm = 170, age_years = 30, sex = 'male' } = settings
  return sex === 'female'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age_years - 161
    : 10 * weight_kg + 6.25 * height_cm - 5 * age_years + 5
}

async function fetchDailyTDEE(token: string, days = 90) {
  const cutoff = dateStr(new Date(Date.now() - days * 86400000))
  const today = dateStr(new Date())

  const res = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/calories-in-heart-rate-zone:dailyRollUp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ civilTimeRange: { startDate: cutoff, endDate: today } }),
  })

  if (res.status === 401) { disconnectGoogleHealth(true); throw new Error('Session expired') }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `HR-zone calories fetch failed (${res.status})`)
  }

  const data = await res.json()
  const settings = useAppStore.getState().settings as { weight_kg?: number; height_cm?: number; age_years?: number; sex?: string }
  const bmr = estimateBMR(settings)

  const rollups = data.rollups ?? data.dailyRollups ?? data.dataPoints ?? []
  return rollups.map((r: { date?: string; civilDate?: string; interval?: { startTime?: string }; caloriesInHeartRateZone?: unknown; rollup?: unknown }) => {
    const date = r.date ?? r.civilDate ?? r.interval?.startTime?.slice(0, 10)
    if (!date || date < cutoff) return null

    const zones = r.caloriesInHeartRateZone ?? r.rollup ?? r
    let activeKcal = 0
    if (typeof zones === 'object' && zones !== null) {
      for (const v of Object.values(zones as Record<string, unknown>)) {
        activeKcal += typeof v === 'number' ? v : ((v as { kcal?: number; calories?: number })?.kcal ?? (v as { kcal?: number; calories?: number })?.calories ?? 0)
      }
    }
    if (activeKcal <= 0) return null

    return { date, kcal: Math.round(activeKcal + bmr) }
  }).filter((p: unknown): p is { date: string; kcal: number } => !!p)
}

export async function calibrateTDEETargets({ silent = false }: { silent?: boolean } = {}) {
  if (!googleHealthIsConnected()) return
  if (!useAppStore.getState().currentUser) return
  let token: string
  try { token = await getValidAccessToken() } catch { return }

  let points
  try {
    points = await fetchDailyTDEE(token, 90)
  } catch (e) {
    if (!silent) showToast('TDEE fetch: ' + (e as Error).message)
    return
  }

  if (points.length < 7) {
    if (!silent) showToast('Not enough Google Health data to calibrate (need at least 7 days)')
    return
  }

  const workoutDates = new Set<string>()
  try {
    const data = useAppStore.getState().dbCache ?? await db.load()
    Object.keys(data.workouts || {}).forEach((d) => workoutDates.add(d))
  } catch { /* non-fatal */ }

  const restPoints = points.filter((p: { date: string }) => !workoutDates.has(p.date))
  const trainingPoints = points.filter((p: { date: string }) => workoutDates.has(p.date))

  const avg = (arr: { kcal: number }[]) => (arr.length ? Math.round(arr.reduce((s, p) => s + p.kcal, 0) / arr.length) : null)

  const calRest = avg(restPoints)
  const calTraining = trainingPoints.length >= 3 ? avg(trainingPoints) : null

  if (!calRest) {
    if (!silent) showToast('Not enough rest-day data to calibrate')
    return
  }

  try {
    await db.saveSettings({
      cal_rest: calRest,
      cal_training: calTraining ?? calRest,
      tdee_source: 'google-health',
      tdee_calibrated_at: new Date().toISOString(),
    })
    TARGETS.calories.rest = calRest
    TARGETS.calories.training = calTraining ?? calRest
    if (!silent) showToast(`Calorie targets updated from Google Health (rest ${calRest} kcal${calTraining ? `, training ${calTraining} kcal` : ''})`)
  } catch (e) {
    if (!silent) showToast('Calibration save failed: ' + (e as Error).message)
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
    try { await db.deleteIntegration('google-health') } catch (e) { console.error(e) }
  }

  if (!silent) showToast('Google Health disconnected')
}

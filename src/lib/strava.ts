import { dateStr, type WorkoutEntry } from './utils'
import { db, supabase, parseWorkoutStart } from './db'
import { useAppStore } from '../store'
import { showToast } from './toast'
import { startSync, endSync, failSync } from './sync-status'
import { STRAVA_CLIENT_ID as DEFAULT_CLIENT_ID, EDGE_FUNCTION_URL, TARGETS } from './config'

const S_CUSTOM_FLAG = 'strava-use-custom'
const S_CLIENT_ID = 'strava-client-id'
const S_CLIENT_SECRET = 'strava-client-secret'
const S_ACCESS_TOKEN = 'strava-access-token'
const S_REFRESH_TOKEN = 'strava-refresh-token'
const S_EXPIRES_AT = 'strava-expires-at'
const S_ATHLETE_NAME = 'strava-athlete-name'
const S_LAST_SYNC = 'strava-last-sync'
const S_CONNECTED = 'strava-connected'
const S_SYNC_WEIGHT = 'strava-sync-weight'

export const stravaUsesCustom = () => localStorage.getItem(S_CUSTOM_FLAG) === 'true'
export const stravaCustomId = () => localStorage.getItem(S_CLIENT_ID) || ''
export const stravaCustomSecret = () => localStorage.getItem(S_CLIENT_SECRET) || ''
export const stravaClientId = () => (stravaUsesCustom() ? stravaCustomId() : DEFAULT_CLIENT_ID)
export const stravaAthleteName = () => localStorage.getItem(S_ATHLETE_NAME) || ''
export const stravaLastSync = () => Number(localStorage.getItem(S_LAST_SYNC) || 0)

export const stravaIsConnected = () => {
  if (stravaUsesCustom()) return !!localStorage.getItem(S_REFRESH_TOKEN)
  return localStorage.getItem(S_CONNECTED) === 'true'
}

let _tokenPromise: Promise<string> | null = null

export async function handleStravaCallback() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('state') !== 'strava-oauth') return
  const code = params.get('code')
  if (!code) return

  history.replaceState(null, '', location.pathname + location.hash)
  showToast('Connecting Strava…')

  try {
    if (stravaUsesCustom()) {
      const clientId = stravaCustomId()
      const clientSecret = stravaCustomSecret()
      if (!clientId || !clientSecret) throw new Error('Missing custom credentials')

      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
      })
      if (!resp.ok) throw new Error(`Token exchange failed (${resp.status})`)
      const data = await resp.json()

      localStorage.setItem(S_ACCESS_TOKEN, data.access_token)
      localStorage.setItem(S_REFRESH_TOKEN, data.refresh_token)
      localStorage.setItem(S_EXPIRES_AT, String(Math.floor(data.expires_at * 1000)))
      const name = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ')
      if (name) localStorage.setItem(S_ATHLETE_NAME, name)
      showToast(`Strava connected${name ? ' as ' + name : ''}`)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${EDGE_FUNCTION_URL}/strava-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'exchange', code }),
      })
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `Exchange failed (${resp.status})`)
      }
      const data = await resp.json()
      if (data.error) throw new Error(data.error)

      localStorage.setItem(S_CONNECTED, 'true')
      if (data.displayName) localStorage.setItem(S_ATHLETE_NAME, data.displayName)
      showToast(`Strava connected${data.displayName ? ' as ' + data.displayName : ''}`)
    }
  } catch (e) {
    console.error('Strava OAuth error:', e)
    showToast('Strava: ' + (e as Error).message)
  }
}

async function getValidAccessToken(): Promise<string> {
  if (stravaUsesCustom()) {
    const expiresAt = Number(localStorage.getItem(S_EXPIRES_AT) || 0)
    if (expiresAt > Date.now() + 60_000) return localStorage.getItem(S_ACCESS_TOKEN)!

    const clientId = stravaCustomId()
    const clientSecret = stravaCustomSecret()
    const refreshToken = localStorage.getItem(S_REFRESH_TOKEN)
    if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing credentials')

    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    if (!resp.ok) {
      if (resp.status === 401) { disconnectStrava(true); throw new Error('Session expired') }
      throw new Error(`Token refresh failed (${resp.status})`)
    }
    const data = await resp.json()
    localStorage.setItem(S_ACCESS_TOKEN, data.access_token)
    localStorage.setItem(S_REFRESH_TOKEN, data.refresh_token)
    localStorage.setItem(S_EXPIRES_AT, String(Math.floor(data.expires_at * 1000)))
    return data.access_token
  } else {
    if (!_tokenPromise) {
      _tokenPromise = (async () => {
        let { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          const { data } = await supabase.auth.refreshSession()
          session = data.session
        }
        if (!session?.access_token) throw new Error('Not signed in — please reload')
        const resp = await fetch(`${EDGE_FUNCTION_URL}/strava-oauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'refresh' }),
        })
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 400) throw new Error('Strava session expired — please reconnect Strava')
          throw new Error(`Refresh failed (${resp.status})`)
        }
        const data = await resp.json()
        if (data.error) throw new Error(data.error)
        return data.accessToken
      })().finally(() => { _tokenPromise = null })
    }
    return _tokenPromise
  }
}

interface StravaActivity {
  id: number | string
  name?: string
  sport_type?: string
  moving_time?: number
  suffer_score?: number | null
  start_date?: string
  start_date_local?: string
  created_at?: string
  calories?: number
  distance?: number
}

function mapActivity(act: StravaActivity): WorkoutEntry {
  const secs = act.moving_time || 0
  const suffer = act.suffer_score ?? null
  const intensity = suffer === null ? 'medium' : suffer < 50 ? 'low' : suffer <= 150 ? 'medium' : 'high'

  const startTime = act.start_date || act.start_date_local || act.created_at || ''
  let timeStr = ''
  if (startTime) {
    const d = new Date(startTime)
    if (!isNaN(d.getTime())) timeStr = d.toISOString()
  }

  return {
    description: act.name || act.sport_type || 'Strava activity',
    sport_type: act.sport_type || undefined,
    intensity,
    calories_burned: (() => {
      const gross = act.calories || null
      if (!gross) return undefined
      const durationMin = secs ? secs / 60 : 0
      if (!durationMin) return Math.round(gross)
      const bmrPerMin = (TARGETS.calories.bmr || 1800) / 1440
      return Math.max(0, Math.round(gross - bmrPerMin * durationMin))
    })(),
    distance_km: act.distance ? parseFloat((act.distance / 1000).toFixed(1)) : null,
    duration_min: secs ? Math.round(secs / 60) : undefined,
    source: 'strava',
    external_id: String(act.id),
    time: timeStr || new Date().toISOString(),
  }
}

let appInactiveNotified = false
function notifyAppInactiveOnce() {
  if (appInactiveNotified) return
  appInactiveNotified = true
  showToast('Strava API app is inactive — its owner must reactivate it at strava.com/settings/api (requires a Strava subscription)')
}

let stravaSyncInProgress = false

export async function syncStrava({ onComplete }: { onComplete?: () => void | Promise<void> } = {}) {
  if (!stravaIsConnected()) return
  if (stravaSyncPaused()) return
  if (stravaSyncInProgress) return
  stravaSyncInProgress = true
  startSync('Strava')
  let newCount = 0
  try {
    const token = await getValidAccessToken()

    const after = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000)
    const resp = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (resp.status === 401) { disconnectStrava(true); throw new Error('Session expired') }
    if (resp.status === 403) {
      const body = await resp.text().catch(() => '')
      console.error('Strava 403 body:', body)
      if (body.includes('"code":"Inactive"')) {
        // Strava Developer Program: the API *application* is deactivated
        // (its owner needs an active Strava subscription + reactivation at
        // strava.com/settings/api). Tokens are fine — don't disconnect,
        // reconnecting can't fix this.
        notifyAppInactiveOnce()
        throw new Error('Strava API application is inactive')
      }
      // Otherwise the token lacks activity:read scope (permission unchecked
      // at authorize time, or access edited/revoked on strava.com). This
      // never self-heals — force a clean re-connect.
      disconnectStrava(true)
      showToast('Strava access denied — please reconnect Strava')
      throw new Error('Missing Strava permissions')
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      console.error(`Strava API ${resp.status} body:`, body)
      throw new Error(`Strava API error (${resp.status})`)
    }

    const activities: StravaActivity[] = await resp.json()
    const afterDate = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    const localEntries = await db.getStravaEntriesSince(afterDate)
    if (localEntries.length) {
      const stravaIds = new Set(activities.map((a) => String(a.id)))
      const toDelete = localEntries.filter((e) => e.external_id && !stravaIds.has(e.external_id)).map((e) => e.id)
      if (toDelete.length) await db.deleteWorkoutsByIds(toDelete)
    }

    if (activities.length) {
      const ids = activities.map((a) => String(a.id))
      const existing = await db.getStravaIds(ids)
      const seen = new Set(existing)
      const newActivities = activities.filter((a) => !seen.has(String(a.id)))

      if (newActivities.length) {
        const detailed = await Promise.all(
          newActivities.map(async (a) => {
            try {
              const r = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`, { headers: { Authorization: `Bearer ${token}` } })
              return r.ok ? r.json() : a
            } catch { return a }
          })
        )

        const toInsert = detailed.map((a: StravaActivity) => {
          const startTime = a.start_date_local || a.start_date || a.created_at || ''
          const dStr = startTime ? startTime.slice(0, 10) : dateStr()
          return { date: dStr, ...mapActivity(a) }
        })

        await db.insertWorkouts(toInsert)
        newCount = toInsert.length
      }
    }

    localStorage.setItem(S_LAST_SYNC, String(Date.now()))
    if (onComplete) await onComplete()
  } catch (e) {
    console.error('Strava sync error:', e)
    stravaSyncInProgress = false
    failSync('Strava')
    return newCount
  }
  stravaSyncInProgress = false
  endSync('Strava')
  return newCount
}

export function connectStrava(custom?: { clientId: string; clientSecret: string }) {
  if (custom) {
    if (!custom.clientId || !custom.clientSecret) { showToast('Enter both Client ID and Client Secret'); return }
    localStorage.setItem(S_CUSTOM_FLAG, 'true')
    localStorage.setItem(S_CLIENT_ID, custom.clientId)
    localStorage.setItem(S_CLIENT_SECRET, custom.clientSecret)
  } else {
    localStorage.removeItem(S_CUSTOM_FLAG)
  }

  const clientId = stravaClientId()
  if (!clientId) { showToast('Application Client ID is missing. Use custom credentials or configure config.ts'); return }

  const redirectUri = window.location.origin + window.location.pathname
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  // 'force' always shows Strava's consent screen. With 'auto', a previously
  // authorized app is silently re-approved with its OLD scopes — so a user who
  // originally granted too few permissions could never fix it by reconnecting.
  url.searchParams.set('approval_prompt', 'force')
  url.searchParams.set('scope', 'activity:read_all,activity:write,profile:write')
  url.searchParams.set('state', 'strava-oauth')
  window.location.href = url.toString()
}

export const stravaAutoPushEnabled = () => (useAppStore.getState().settings as { strava_auto_push?: boolean })?.strava_auto_push ?? (localStorage.getItem('strava-auto-push') === 'true')
export const stravaAutoPushGoogleEnabled = () => (useAppStore.getState().settings as { strava_auto_push_google?: boolean })?.strava_auto_push_google ?? (localStorage.getItem('strava-auto-push-google') === 'true')
export const stravaSyncPaused = () => (useAppStore.getState().settings as { strava_sync_paused?: boolean })?.strava_sync_paused ?? (localStorage.getItem('strava-sync-paused') === '1')
export const stravaWeightSyncEnabled = () => (useAppStore.getState().settings as { strava_weight_sync?: boolean })?.strava_weight_sync ?? (localStorage.getItem(S_SYNC_WEIGHT) === 'true')

const ACTIVITY_TYPE_TO_STRAVA: Record<string, string> = {
  run: 'Run', walk: 'Walk', hike: 'Hike', cycle: 'Ride', ride: 'Ride',
  swim: 'Swim', yoga: 'Yoga', gym: 'WeightTraining', weights: 'WeightTraining',
  crossfit: 'Crossfit', rowing: 'Rowing', soccer: 'Soccer',
  tennis: 'Tennis', skiing: 'AlpineSki', golf: 'Golf',
  pilates: 'Pilates', surfing: 'Surfing', snowboard: 'Snowboard',
}

function buildTcx(entry: WorkoutEntry, startIso: string, sportType: string) {
  const tcxSport = sportType === 'Run' ? 'Running' : sportType === 'Ride' ? 'Biking' : 'Other'
  const elapsedSec = entry.duration_min ? Math.round(entry.duration_min * 60) : 0
  const distanceMeters = entry.distance_km ? entry.distance_km * 1000 : 0
  const avgHr = entry.heart_rate_avg ? Math.round(entry.heart_rate_avg) : null

  const startMs = new Date(startIso).getTime()
  const interval = 60
  const trackpoints: string[] = []
  for (let s = 0; s <= elapsedSec; s += interval) {
    const tIso = new Date(startMs + s * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
    const dist = distanceMeters ? (distanceMeters * s / elapsedSec).toFixed(1) : null
    const hrTag = avgHr ? `\n            <HeartRateBpm><Value>${avgHr}</Value></HeartRateBpm>` : ''
    trackpoints.push(`          <Trackpoint>
            <Time>${tIso}</Time>${dist ? `\n            <DistanceMeters>${dist}</DistanceMeters>` : ''}${hrTag}
          </Trackpoint>`)
  }

  const hrSummary = avgHr
    ? `\n        <AverageHeartRateBpm><Value>${avgHr}</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>${Math.min(avgHr + 10, 200)}</Value></MaximumHeartRateBpm>`
    : ''

  const bmrPerMin = (TARGETS.calories.bmr || 1800) / 1440
  const grossCalories = entry.calories_burned
    ? Math.round(entry.calories_burned + bmrPerMin * (entry.duration_min || 0))
    : 0

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="${tcxSport}">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${elapsedSec}</TotalTimeSeconds>
        <DistanceMeters>${distanceMeters}</DistanceMeters>
        <Calories>${grossCalories}</Calories>${hrSummary}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints.join('\n')}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`
}

export async function pushActivityToStrava(entry: WorkoutEntry) {
  if (!stravaIsConnected()) throw new Error('Strava not connected')
  const token = await getValidAccessToken()
  const sportType = ACTIVITY_TYPE_TO_STRAVA[(entry.activity_type || '').toLowerCase()] || 'Workout'

  const startMs = parseWorkoutStart(entry.date, entry.time)
  if (!startMs) throw new Error('Set a specific time on the activity before pushing to Strava')
  const pad = (n: number) => String(n).padStart(2, '0')
  const toLocalIso = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const startIso = toLocalIso(startMs)

  const description = 'Logged via MyTracker: https://github.com/gonespral/my-tracker'
  const tcx = buildTcx(entry, startIso, sportType)
  const form = new FormData()
  const filename = `activity-${entry.id || startIso.replace(/[:.]/g, '-')}.tcx`
  form.append('file', new Blob([tcx], { type: 'application/octet-stream' }), filename)
  form.append('data_type', 'tcx')
  form.append('name', entry.description || 'Workout')
  form.append('sport_type', sportType)
  form.append('description', description)

  const uploadResp = await fetch('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (uploadResp.status === 401) { disconnectStrava(true); throw new Error('Session expired — please reconnect Strava') }
  if (uploadResp.status === 403) throw new Error('Write permission missing — reconnect Strava to enable pushing')
  if (!uploadResp.ok) {
    const raw = await uploadResp.text().catch(() => '')
    let msg = `${uploadResp.status}`
    try { const j = JSON.parse(raw); msg = j.message || j.error || JSON.stringify(j.errors) || msg } catch { /* not json */ }
    throw new Error(`Strava: ${msg}`)
  }

  const upload = await uploadResp.json()

  let activityId = upload.activity_id
  const uploadId = upload.id || upload.id_str
  if (!activityId && uploadId) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const poll = await fetch(`https://www.strava.com/api/v3/uploads/${uploadId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!poll.ok) break
      const status = await poll.json()
      if (status.error) throw new Error(`Strava upload error: ${status.error}`)
      if (status.status && /error/i.test(status.status)) throw new Error(`Strava: ${status.status}`)
      if (status.activity_id) { activityId = status.activity_id; break }
    }
  }

  if (!activityId) throw new Error('Strava: upload timed out or failed to process')
  return { id: activityId as string | number }
}

export const setStravaWeightSync = (v: boolean) => {
  useAppStore.setState((s) => ({ settings: { ...s.settings, strava_weight_sync: !!v } }))
  db.saveSettings({ strava_weight_sync: !!v }).catch(() => {})
}

export async function updateStravaAthleteWeight(kg: number) {
  if (!stravaIsConnected() || !stravaWeightSyncEnabled()) return
  try {
    const token = await getValidAccessToken()
    await fetch('https://www.strava.com/api/v3/athlete', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: kg }),
    })
  } catch (e) {
    console.error('Strava weight update failed:', e)
  }
}

export async function deleteActivityFromStrava(stravaId: string) {
  if (!stravaIsConnected()) throw new Error('Strava not connected')
  const token = await getValidAccessToken()
  const resp = await fetch(`https://www.strava.com/api/v3/activities/${stravaId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (resp.status === 401) throw new Error('Strava refused deletion (401) — try disconnecting and reconnecting Strava to refresh permissions.')
  if (resp.status === 403) throw new Error("Strava refused the deletion — this activity wasn't created by this app and can't be deleted here.")
  if (!resp.ok && resp.status !== 204) {
    const raw = await resp.text().catch(() => '')
    let msg = `${resp.status}`
    try { const j = JSON.parse(raw); msg = j.message || j.error || msg } catch { /* not json */ }
    throw new Error(`Strava delete failed: ${msg}`)
  }
}

export async function disconnectStrava(silent = false) {
  localStorage.removeItem(S_ACCESS_TOKEN)
  localStorage.removeItem(S_REFRESH_TOKEN)
  localStorage.removeItem(S_EXPIRES_AT)
  localStorage.removeItem(S_ATHLETE_NAME)
  localStorage.removeItem(S_LAST_SYNC)
  localStorage.removeItem(S_CONNECTED)

  if (!stravaUsesCustom()) {
    try { await db.deleteIntegration('strava') } catch (e) { console.error(e) }
  }

  if (!silent) showToast('Strava disconnected')
}

import { nowTime, dateStr } from './utils.js'
import { db, supabase, parseWorkoutStart } from './db.js'
import { showToast } from './ui.js'
import { STRAVA_CLIENT_ID as DEFAULT_CLIENT_ID, EDGE_FUNCTION_URL } from './config.js'

const S_CUSTOM_FLAG = 'strava-use-custom'
const S_CLIENT_ID = 'strava-client-id'
const S_CLIENT_SECRET = 'strava-client-secret'
const S_ACCESS_TOKEN = 'strava-access-token'
const S_REFRESH_TOKEN = 'strava-refresh-token'
const S_EXPIRES_AT = 'strava-expires-at'
const S_ATHLETE_NAME = 'strava-athlete-name'
const S_LAST_SYNC = 'strava-last-sync'
const S_CONNECTED = 'strava-connected'

export const stravaUsesCustom = () => localStorage.getItem(S_CUSTOM_FLAG) === 'true'
export const stravaCustomId = () => localStorage.getItem(S_CLIENT_ID) || ''
export const stravaCustomSecret = () => localStorage.getItem(S_CLIENT_SECRET) || ''
export const stravaClientId = () => stravaUsesCustom() ? stravaCustomId() : DEFAULT_CLIENT_ID

export const stravaIsConnected = () => {
  if (stravaUsesCustom()) return !!localStorage.getItem(S_REFRESH_TOKEN)
  return localStorage.getItem(S_CONNECTED) === 'true'
}

let sessionAccessToken = null

function formatTimeAgo(ms) {
  const secs = Math.floor((Date.now() - ms) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function updateStravaSettingsSection() {
  const disconnected = document.getElementById('strava-disconnected-ui')
  const connected = document.getElementById('strava-connected-ui')
  if (!disconnected || !connected) return

  const isConnected = stravaIsConnected()
  disconnected.style.display = isConnected ? 'none' : 'block'
  connected.style.display = isConnected ? 'block' : 'none'

  if (isConnected) {
    const name = localStorage.getItem(S_ATHLETE_NAME) || 'Strava account'
    const nameEl = document.getElementById('strava-athlete-label')
    if (nameEl) nameEl.textContent = `Connected as ${name}`
    const syncEl = document.getElementById('strava-last-sync-label')
    if (syncEl) {
      const last = Number(localStorage.getItem(S_LAST_SYNC) || 0)
      syncEl.textContent = last ? `Last synced: ${formatTimeAgo(last)}` : 'Last synced: never'
    }
  } else {
    const customCb = document.getElementById('strava-custom-cb')
    if (customCb) customCb.checked = stravaUsesCustom()
    const customFields = document.getElementById('strava-custom-fields')
    if (customFields) customFields.style.display = stravaUsesCustom() ? 'block' : 'none'

    const cidEl = document.getElementById('strava-cid-input')
    if (cidEl) cidEl.value = stravaCustomId()
    const csecEl = document.getElementById('strava-csecret-input')
    if (csecEl) csecEl.value = stravaCustomSecret()
  }
}

export async function handleStravaCallback() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('state') !== 'strava-oauth') return
  const code = params.get('code')
  if (!code) return

  history.replaceState(null, '', location.pathname + location.hash)

  showToast('🔄 Connecting Strava…')

  try {
    if (stravaUsesCustom()) {
      const clientId = stravaCustomId()
      const clientSecret = stravaCustomSecret()
      if (!clientId || !clientSecret) throw new Error('Missing custom credentials')

      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      })
      if (!resp.ok) throw new Error(`Token exchange failed (${resp.status})`)
      const data = await resp.json()

      localStorage.setItem(S_ACCESS_TOKEN, data.access_token)
      localStorage.setItem(S_REFRESH_TOKEN, data.refresh_token)
      localStorage.setItem(S_EXPIRES_AT, String(Math.floor(data.expires_at * 1000)))
      const name = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ')
      if (name) localStorage.setItem(S_ATHLETE_NAME, name)
      showToast(`✅ Strava connected${name ? ' as ' + name : ''}`)

    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${EDGE_FUNCTION_URL}/strava-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
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
      showToast(`✅ Strava connected${data.displayName ? ' as ' + data.displayName : ''}`)
    }
  } catch (e) {
    console.error('Strava OAuth error:', e)
    showToast('❌ Strava: ' + e.message)
  }
}

async function getValidAccessToken() {
  if (stravaUsesCustom()) {
    const expiresAt = Number(localStorage.getItem(S_EXPIRES_AT) || 0)
    if (expiresAt > Date.now() + 60_000) return localStorage.getItem(S_ACCESS_TOKEN)

    const clientId = stravaCustomId()
    const clientSecret = stravaCustomSecret()
    const refreshToken = localStorage.getItem(S_REFRESH_TOKEN)
    if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing credentials')

    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!resp.ok) {
      if (resp.status === 401) {
        disconnectStrava(true)
        throw new Error('Session expired')
      }
      throw new Error(`Token refresh failed (${resp.status})`)
    }
    const data = await resp.json()
    localStorage.setItem(S_ACCESS_TOKEN, data.access_token)
    localStorage.setItem(S_REFRESH_TOKEN, data.refresh_token)
    localStorage.setItem(S_EXPIRES_AT, String(Math.floor(data.expires_at * 1000)))
    return data.access_token
  } else {
    // Edge function flow
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(`${EDGE_FUNCTION_URL}/strava-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'refresh' }),
    })
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 400) {
        disconnectStrava(true)
        throw new Error('Session expired')
      }
      throw new Error(`Refresh failed (${resp.status})`)
    }
    const data = await resp.json()
    if (data.error) throw new Error(data.error)
    return data.accessToken
  }
}

function mapActivity(act) {
  const secs = act.moving_time || act.movingTime || 0
  const suffer = act.suffer_score ?? act.sufferScore ?? null
  const intensity = suffer === null ? 'medium'
    : suffer < 50 ? 'low'
      : suffer <= 150 ? 'medium'
        : 'high'

  const startTime = act.start_date || act.start_date_local || act.startDateLocal || act.startDate || act.created_at || act.time || ''

  let timeStr = ''
  if (startTime) {
    const d = new Date(startTime)
    if (!isNaN(d.getTime())) timeStr = d.toISOString()
  }

  return {
    description: act.name || act.sport_type || act.sportType || 'Strava activity',
    sport_type: act.sport_type || act.sportType || null,
    intensity,
    calories_burned: act.calories || act.caloriesBurned || null,
    distance_km: act.distance ? parseFloat((act.distance / 1000).toFixed(1)) : null,
    duration_min: secs ? Math.round(secs / 60) : null,
    source: 'strava',
    external_id: String(act.id),
    time: timeStr || new Date().toISOString(),
  }
}

export async function syncStrava({ silent = false, onComplete = null } = {}) {
  if (!stravaIsConnected()) return
  if (!silent) showToast('🔄 Syncing Strava…')

  try {
    const token = await getValidAccessToken()

    const after = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000)
    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (resp.status === 401) {
      disconnectStrava(true)
      throw new Error('Session expired')
    }
    if (!resp.ok) throw new Error(`Strava API error (${resp.status})`)

    const activities = await resp.json()
    const afterDate = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    // Remove local Strava entries deleted on Strava
    const localEntries = await db.getStravaEntriesSince(afterDate)
    if (localEntries.length) {
      const stravaIds = new Set(activities.map(a => String(a.id)))
      const toDelete = localEntries.filter(e => e.external_id && !stravaIds.has(e.external_id)).map(e => e.id)
      if (toDelete.length) await db.deleteWorkoutsByIds(toDelete)
    }

    if (activities.length) {
      const ids = activities.map(a => String(a.id))
      const existing = await db.getStravaIds(ids)
      const seen = new Set(existing)

      const newActivities = activities.filter(a => !seen.has(String(a.id)))

      if (newActivities.length) {
        const detailed = await Promise.all(
          newActivities.map(async a => {
            try {
              const r = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`,
                { headers: { Authorization: `Bearer ${token}` } })
              return r.ok ? r.json() : a
            } catch { return a }
          })
        )

        const toInsert = detailed.map(a => {
          const startTime = a.start_date_local || a.start_date || a.startDateLocal || a.startDate || a.created_at || a.time || ''
          const dStr = startTime ? startTime.slice(0, 10) : dateStr()
          return {
            date: dStr,
            ...mapActivity(a),
          }
        })

        await db.insertWorkouts(toInsert)
        showToast(`✅ Synced ${toInsert.length} new activit${toInsert.length === 1 ? 'y' : 'ies'}`)
      } else {
        if (!silent) showToast('✅ Strava: already up to date')
      }
    } else {
      if (!silent) showToast('✅ Strava: no new activities')
    }

    localStorage.setItem(S_LAST_SYNC, String(Date.now()))
    updateStravaSettingsSection()
    if (onComplete) await onComplete()
  } catch (e) {
    console.error('Strava sync error:', e)
    if (!silent) showToast('❌ Strava: ' + e.message)
  }
}

export function connectStrava() {
  const isCustom = document.getElementById('strava-custom-cb')?.checked
  if (isCustom) {
    const id = document.getElementById('strava-cid-input')?.value.trim()
    const secret = document.getElementById('strava-csecret-input')?.value.trim()
    if (!id || !secret) { showToast('❌ Enter both Client ID and Client Secret'); return }
    localStorage.setItem(S_CUSTOM_FLAG, 'true')
    localStorage.setItem(S_CLIENT_ID, id)
    localStorage.setItem(S_CLIENT_SECRET, secret)
  } else {
    localStorage.removeItem(S_CUSTOM_FLAG)
  }

  const clientId = stravaClientId()
  if (!clientId) {
    showToast('❌ Application Client ID is missing. Use custom credentials or configure config.js')
    return
  }

  const redirectUri = window.location.origin + window.location.pathname
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', 'activity:read_all,activity:write,profile:write')
  url.searchParams.set('state', 'strava-oauth')
  window.location.href = url.toString()
}

export const stravaAutoPushEnabled = () => localStorage.getItem('strava-auto-push') === 'true'
export const stravaAutoPushGoogleEnabled = () => localStorage.getItem('strava-auto-push-google') === 'true'

// Only sport_type values accepted by Strava's API — combat sports and others
// not in Strava's enum fall through to the 'Workout' default below.
const ACTIVITY_TYPE_TO_STRAVA = {
  run: 'Run', walk: 'Walk', hike: 'Hike', cycle: 'Ride', ride: 'Ride',
  swim: 'Swim', yoga: 'Yoga', gym: 'WeightTraining', weights: 'WeightTraining',
  crossfit: 'Crossfit', rowing: 'Rowing', soccer: 'Soccer',
  tennis: 'Tennis', skiing: 'AlpineSki', golf: 'Golf',
  pilates: 'Pilates', surfing: 'Surfing', snowboard: 'Snowboard',
}

// Keytel et al. (2005) formula — solve for HR given target cal/min, weight, age, sex
function targetHrForCalories(calories, durationMin, weightKg, ageYears, sex) {
  if (!calories || !durationMin || !weightKg || !ageYears) return null
  const calPerMin = calories / durationMin
  let hr
  if (sex === 'female') {
    hr = (calPerMin * 4.184 + 20.4022 + 0.1263 * weightKg - 0.074 * ageYears) / 0.4472
  } else {
    hr = (calPerMin * 4.184 + 55.0969 - 0.1988 * weightKg - 0.2017 * ageYears) / 0.6309
  }
  hr = Math.round(hr)
  return (hr >= 60 && hr <= 200) ? hr : null
}

function buildTcx(entry, startIso, sportType, targetHr) {
  const tcxSport = sportType === 'Run' ? 'Running' : sportType === 'Ride' ? 'Biking' : 'Other'
  const elapsedSec = entry.duration_min ? Math.round(entry.duration_min * 60) : 0
  const distanceMeters = entry.distance_km ? entry.distance_km * 1000 : 0
  const avgHr = targetHr || (entry.heart_rate_avg ? Math.round(entry.heart_rate_avg) : null)

  // One trackpoint every 60s with slight HR variation to look natural
  const startMs = new Date(startIso).getTime()
  const interval = 60
  const trackpoints = []
  for (let s = 0; s <= elapsedSec; s += interval) {
    const tIso = new Date(startMs + s * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
    const dist = distanceMeters ? (distanceMeters * s / elapsedSec).toFixed(1) : null
    let hrTag = ''
    if (avgHr) {
      const jitter = Math.round((Math.random() - 0.5) * 6)
      hrTag = `\n            <HeartRateBpm><Value>${avgHr + jitter}</Value></HeartRateBpm>`
    }
    trackpoints.push(`          <Trackpoint>
            <Time>${tIso}</Time>${dist ? `\n            <DistanceMeters>${dist}</DistanceMeters>` : ''}${hrTag}
          </Trackpoint>`)
  }

  const hrSummary = avgHr
    ? `\n        <AverageHeartRateBpm><Value>${avgHr}</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>${Math.min(avgHr + 10, 200)}</Value></MaximumHeartRateBpm>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="${tcxSport}">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${elapsedSec}</TotalTimeSeconds>
        <DistanceMeters>${distanceMeters}</DistanceMeters>
        <Calories>${entry.calories_burned ? Math.round(entry.calories_burned) : 0}</Calories>${hrSummary}
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

export async function pushActivityToStrava(entry) {
  if (!stravaIsConnected()) throw new Error('Strava not connected')

  const token = await getValidAccessToken()
  const sportType = ACTIVITY_TYPE_TO_STRAVA[(entry.activity_type || '').toLowerCase()] || 'Workout'

  const startMs = parseWorkoutStart(entry.date, entry.time)
  if (!startMs) throw new Error('Set a specific time on the activity before pushing to Strava')
  const pad = n => String(n).padStart(2, '0')
  const toLocalIso = ms => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const startIso = toLocalIso(startMs)

  // Use TCX file upload only when calorie spoofing is enabled (requires synthetic HR)
  let targetHr = null
  if (stravaSpoofCaloriesEnabled() && entry.calories_burned && entry.duration_min) {
    const profile = await db.loadSettings().catch(() => null)
    const weight = Number(profile?.weight_kg) || null
    const age = Number(profile?.age_years) || null
    const sex = profile?.sex || 'male'
    targetHr = targetHrForCalories(entry.calories_burned, entry.duration_min, weight, age, sex)
    if (targetHr) console.log('[Strava push] synthetic HR for calories:', targetHr)
  }

  const description = [
    'Logged via MyTracker: https://github.com/gonespral/my-tracker',
    targetHr ? 'Calorie spoofing enabled.' : null,
  ].filter(Boolean).join('\n')

  if (targetHr) {
    return pushViaTcx({ entry, token, sportType, startIso, targetHr, description })
  }

  // Default: manual activity creation — no file upload, no processing errors
  console.log('[Strava push] manual activity, start:', startIso, 'sport:', sportType)
  const body = {
    name: entry.description || 'Workout',
    sport_type: sportType,
    start_date_local: startIso,
    elapsed_time: entry.duration_min ? Math.round(entry.duration_min * 60) : 60,
    description,
  }
  if (entry.distance_km) body.distance = entry.distance_km * 1000

  const resp = await fetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (resp.status === 401) { disconnectStrava(true); throw new Error('Session expired — please reconnect Strava') }
  if (resp.status === 403) throw new Error('Write permission missing — reconnect Strava to enable pushing')
  if (!resp.ok) {
    const raw = await resp.text().catch(() => '')
    let msg = `${resp.status}`
    try { const j = JSON.parse(raw); msg = j.message || j.error || JSON.stringify(j.errors) || msg } catch (_) {}
    throw new Error(`Strava: ${msg}`)
  }

  const activity = await resp.json()
  if (!activity.id) throw new Error('Strava: no activity ID returned')

  if (entry.calories_burned) {
    await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ calories: Math.round(entry.calories_burned) }),
    }).catch(() => {})
  }

  return { id: activity.id }
}

async function pushViaTcx({ entry, token, sportType, startIso, targetHr, description }) {
  const tcx = buildTcx(entry, startIso, sportType, targetHr)
  const form = new FormData()
  const filename = `activity-${entry.id || startIso.replace(/[:.]/g, '-')}.tcx`
  form.append('file', new Blob([tcx], { type: 'application/octet-stream' }), filename)
  form.append('data_type', 'tcx')
  form.append('name', entry.description || 'Workout')
  form.append('sport_type', sportType)
  form.append('description', description)

  console.log('[Strava push] TCX upload, start:', startIso, 'hr:', targetHr)
  const uploadResp = await fetch('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  })

  if (uploadResp.status === 401) { disconnectStrava(true); throw new Error('Session expired — please reconnect Strava') }
  if (uploadResp.status === 403) throw new Error('Write permission missing — reconnect Strava to enable pushing')
  if (!uploadResp.ok) {
    const raw = await uploadResp.text().catch(() => '')
    let msg = `${uploadResp.status}`
    try { const j = JSON.parse(raw); msg = j.message || j.error || JSON.stringify(j.errors) || msg } catch (_) {}
    throw new Error(`Strava: ${msg}`)
  }

  const upload = await uploadResp.json()
  console.log('[Strava upload response]', upload)

  let activityId = upload.activity_id
  const uploadId = upload.id || upload.id_str
  if (!activityId && uploadId) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const poll = await fetch(`https://www.strava.com/api/v3/uploads/${uploadId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!poll.ok) break
      const status = await poll.json()
      console.log('[Strava upload poll]', status)
      if (status.error) throw new Error(`Strava upload error: ${status.error}`)
      if (status.status && /error/i.test(status.status)) throw new Error(`Strava: ${status.status}`)
      if (status.activity_id) { activityId = status.activity_id; break }
    }
  }

  if (!activityId) throw new Error('Strava: upload timed out or failed to process')
  return { id: activityId }
}

const S_SPOOF_CALORIES = 'strava-spoof-calories'
export const stravaSpoofCaloriesEnabled = () => localStorage.getItem(S_SPOOF_CALORIES) === 'true'
export const setStravaSpoofCalories = v => localStorage.setItem(S_SPOOF_CALORIES, v ? 'true' : 'false')

const S_SYNC_WEIGHT = 'strava-sync-weight'
export const stravaWeightSyncEnabled = () => localStorage.getItem(S_SYNC_WEIGHT) === 'true'
export const setStravaWeightSync = v => localStorage.setItem(S_SYNC_WEIGHT, v ? 'true' : 'false')

export async function updateStravaAthleteWeight(kg) {
  if (!stravaIsConnected() || !stravaWeightSyncEnabled()) return
  try {
    const token = await getValidAccessToken()
    await fetch('https://www.strava.com/api/v3/athlete', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: kg }),
    })
  } catch (e) {
    console.error('Strava weight update failed:', e)
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

  updateStravaSettingsSection()
  if (!silent) showToast('Strava disconnected')
}

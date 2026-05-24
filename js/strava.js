import { nowTime, dateStr } from './utils.js'
import { db } from './db.js'
import { showToast } from './ui.js'

const S_CLIENT_ID     = 'strava-client-id'
const S_CLIENT_SECRET = 'strava-client-secret'
const S_ACCESS_TOKEN  = 'strava-access-token'
const S_REFRESH_TOKEN = 'strava-refresh-token'
const S_EXPIRES_AT    = 'strava-expires-at'
const S_ATHLETE_NAME  = 'strava-athlete-name'
const S_LAST_SYNC     = 'strava-last-sync'

export const stravaClientId     = () => localStorage.getItem(S_CLIENT_ID) || ''
export const stravaClientSecret = () => localStorage.getItem(S_CLIENT_SECRET) || ''
export const stravaAccessToken  = () => localStorage.getItem(S_ACCESS_TOKEN) || ''
export const stravaRefreshToken = () => localStorage.getItem(S_REFRESH_TOKEN) || ''
export const stravaExpiresAt    = () => Number(localStorage.getItem(S_EXPIRES_AT) || 0)
export const stravaIsConnected  = () => !!stravaRefreshToken()

function formatTimeAgo(ms) {
  const secs = Math.floor((Date.now() - ms) / 1000)
  if (secs < 60)    return 'just now'
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function updateStravaSettingsSection() {
  const disconnected = document.getElementById('strava-disconnected-ui')
  const connected    = document.getElementById('strava-connected-ui')
  if (!disconnected || !connected) return

  const isConnected = stravaIsConnected()
  disconnected.style.display = isConnected ? 'none'  : 'block'
  connected.style.display    = isConnected ? 'block' : 'none'

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
    const cidEl = document.getElementById('strava-cid-input')
    if (cidEl) cidEl.value = stravaClientId()
  }
}

export async function handleStravaCallback() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('state') !== 'strava-oauth') return
  const code = params.get('code')
  if (!code) return

  // Strip ?code&state from URL but keep #hash (Supabase session lives there)
  history.replaceState(null, '', location.pathname + location.hash)

  const clientId     = stravaClientId()
  const clientSecret = stravaClientSecret()
  if (!clientId || !clientSecret) {
    showToast('❌ Strava credentials missing — reconnect in Settings')
    return
  }

  showToast('🔄 Connecting Strava…')
  try {
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        grant_type:    'authorization_code',
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err?.message || `Token exchange failed (${resp.status})`)
    }
    const data = await resp.json()
    localStorage.setItem(S_ACCESS_TOKEN,  data.access_token)
    localStorage.setItem(S_REFRESH_TOKEN, data.refresh_token)
    localStorage.setItem(S_EXPIRES_AT,    String(data.expires_at * 1000))
    const name = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ')
    if (name) localStorage.setItem(S_ATHLETE_NAME, name)
    showToast(`✅ Strava connected${name ? ' as ' + name : ''}`)
  } catch (e) {
    console.error('Strava OAuth error:', e)
    showToast('❌ Strava: ' + e.message)
  }
}

async function refreshIfNeeded() {
  if (stravaExpiresAt() > Date.now() + 60_000) return
  const clientId     = stravaClientId()
  const clientSecret = stravaClientSecret()
  if (!clientId || !clientSecret || !stravaRefreshToken()) return

  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: stravaRefreshToken(),
      grant_type:    'refresh_token',
    }),
  })
  if (!resp.ok) throw new Error(`Strava token refresh failed (${resp.status})`)
  const data = await resp.json()
  localStorage.setItem(S_ACCESS_TOKEN,  data.access_token)
  localStorage.setItem(S_REFRESH_TOKEN, data.refresh_token)
  localStorage.setItem(S_EXPIRES_AT,    String(data.expires_at * 1000))
}

function mapActivity(act) {
  const secs = act.moving_time || 0

  const suffer    = act.suffer_score ?? null
  const intensity = suffer === null ? 'medium'
    : suffer < 50  ? 'low'
    : suffer <= 150 ? 'medium'
    : 'high'

  return {
    description:     act.name || act.sport_type || 'Strava activity',
    sport_type:      act.sport_type  || null,
    intensity,
    calories_burned: act.calories    || null,
    distance:        act.distance    || null,
    duration_min:    secs ? Math.round(secs / 60) : null,
    source:          'strava',
    external_id:     String(act.id),
    time:            act.start_date_local || nowTime(),
  }
}

export async function syncStrava({ silent = false, onComplete = null } = {}) {
  if (!stravaIsConnected()) return
  if (!silent) showToast('🔄 Syncing Strava…')

  try {
    await refreshIfNeeded()

    // Always fetch the last 90 days so deleted entries get re-synced.
    // Dedup via getStravaIds prevents double-inserts.
    const after = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000)

    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`,
      { headers: { Authorization: `Bearer ${stravaAccessToken()}` } },
    )

    if (resp.status === 401) {
      localStorage.removeItem(S_ACCESS_TOKEN)
      localStorage.removeItem(S_REFRESH_TOKEN)
      localStorage.removeItem(S_EXPIRES_AT)
      updateStravaSettingsSection()
      showToast('⚠️ Strava session expired — reconnect in Settings')
      return
    }
    if (!resp.ok) throw new Error(`Strava API error (${resp.status})`)

    const activities = await resp.json()

    if (activities.length) {
      const ids      = activities.map(a => String(a.id))
      const existing = await db.getStravaIds(ids)
      const seen     = new Set(existing)

      const newActivities = activities.filter(a => !seen.has(String(a.id)))

      if (newActivities.length) {
        // Fetch detailed data for each new activity to get calories (not in summary)
        const detailed = await Promise.all(
          newActivities.map(async a => {
            try {
              const r = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`,
                { headers: { Authorization: `Bearer ${stravaAccessToken()}` } })
              return r.ok ? r.json() : a
            } catch { return a }
          })
        )

        const toInsert = detailed.map(a => ({
          date: (a.start_date_local || '').slice(0, 10) || dateStr(),
          ...mapActivity(a),
        }))

        await db.insertWorkouts(toInsert)
        if (!silent) showToast(`✅ Synced ${toInsert.length} new activit${toInsert.length === 1 ? 'y' : 'ies'}`)
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
  const id     = document.getElementById('strava-cid-input')?.value.trim()
  const secret = document.getElementById('strava-csecret-input')?.value.trim()
  if (!id || !secret) { showToast('❌ Enter both Client ID and Client Secret'); return }
  localStorage.setItem(S_CLIENT_ID,     id)
  localStorage.setItem(S_CLIENT_SECRET, secret)
  const redirectUri = window.location.origin + window.location.pathname
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id',       id)
  url.searchParams.set('redirect_uri',    redirectUri)
  url.searchParams.set('response_type',   'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope',           'activity:read_all')
  url.searchParams.set('state',           'strava-oauth')
  window.location.href = url.toString()
}

export function disconnectStrava() {
  localStorage.removeItem(S_ACCESS_TOKEN)
  localStorage.removeItem(S_REFRESH_TOKEN)
  localStorage.removeItem(S_EXPIRES_AT)
  localStorage.removeItem(S_ATHLETE_NAME)
  localStorage.removeItem(S_LAST_SYNC)
  updateStravaSettingsSection()
  showToast('Strava disconnected')
}

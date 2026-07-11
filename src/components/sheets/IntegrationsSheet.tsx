import { useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { db, getWorkoutConflictPreference, setWorkoutConflictPreference } from '../../lib/db'
import { showToast } from '../../lib/toast'
import Sheet from '../Sheet'
import Icon from '../Icon'
import {
  stravaIsConnected, stravaUsesCustom, stravaCustomId, stravaCustomSecret, stravaAthleteName, stravaLastSync,
  connectStrava, disconnectStrava, syncStrava, stravaSyncPaused, stravaAutoPushEnabled, stravaAutoPushGoogleEnabled,
  stravaWeightSyncEnabled, setStravaWeightSync,
} from '../../lib/strava'
import {
  googleHealthIsConnected, googleHealthUsesCustom, googleHealthCustomId, googleHealthCustomSecret, googleHealthUserName, googleHealthLastSync,
  connectGoogleHealth, disconnectGoogleHealth, syncGoogleHealth, ghSyncPaused, ghAutoPushEnabled, ghPushStravaImports,
} from '../../lib/google-health'

function formatTimeAgo(ms: number) {
  if (!ms) return 'never'
  const secs = Math.floor((Date.now() - ms) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function saveSetting(key: string, value: unknown) {
  useAppStore.setState((s) => ({ settings: { ...s.settings, [key]: value } }))
  db.saveSettings({ [key]: value }).catch(() => {})
}

export default function IntegrationsSheet() {
  const open = useAppStore((s) => s.openSheetId === 'integrations')
  useAppStore((s) => s.settings) // re-render when settings load/change elsewhere
  const [, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [stravaCustomChecked, setStravaCustomChecked] = useState(stravaUsesCustom())
  const [stravaCid, setStravaCid] = useState(stravaCustomId())
  const [stravaCsecret, setStravaCsecret] = useState(stravaCustomSecret())
  const [stravaSyncing, setStravaSyncing] = useState(false)

  const [ghCustomChecked, setGhCustomChecked] = useState(googleHealthUsesCustom())
  const [ghCid, setGhCid] = useState(googleHealthCustomId())
  const [ghCsecret, setGhCsecret] = useState(googleHealthCustomSecret())
  const [ghSyncing, setGhSyncing] = useState(false)

  const stravaConnected = stravaIsConnected()
  const ghConnected = googleHealthIsConnected()

  async function handleStravaSync() {
    setStravaSyncing(true)
    try {
      const n = await syncStrava({ onComplete: refresh })
      showToast(n ? `Synced ${n} new Strava activities` : 'Strava up to date')
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setStravaSyncing(false)
      refresh()
    }
  }

  async function handleGhSync() {
    setGhSyncing(true)
    try {
      const n = await syncGoogleHealth({ onComplete: refresh })
      showToast(n ? `Synced ${n} new Google Health activities` : 'Google Health up to date')
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setGhSyncing(false)
      refresh()
    }
  }

  async function handleRemoveStrava() {
    if (!confirm('Remove all activities synced from Strava? This only affects locally stored copies.')) return
    await db.deleteStravaWorkouts()
    showToast('Removed synced Strava activities')
    refresh()
  }

  async function handleRemoveGh() {
    if (!confirm('Remove all activities synced from Google Health? This only affects locally stored copies.')) return
    await db.deleteGoogleHealthWorkouts()
    showToast('Removed synced Google Health activities')
    refresh()
  }

  const stravaAutoPushManual = stravaAutoPushEnabled()
  const stravaAutoPushGoogle = stravaAutoPushGoogleEnabled()
  const ghAutoPushManual = ghAutoPushEnabled()
  const ghAutoPushStrava = ghPushStravaImports()

  return (
    <Sheet open={open} title="Integrations">
      <div className="integration-label"><Icon name="directions_run" size={14} /> Strava</div>
      {!stravaConnected ? (
        <div>
          <p className="setup-note">Connect your Strava account to automatically sync activities.</p>
          <div className="toggle-row" style={{ marginBottom: 4 }}>
            <div className="toggle-row-label" style={{ fontSize: 13 }}>Use custom API credentials (self-hosted)</div>
            <label className="toggle-switch">
              <input type="checkbox" checked={stravaCustomChecked} onChange={(e) => setStravaCustomChecked(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          {stravaCustomChecked && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--track)', borderRadius: 8 }}>
              <p className="setup-note" style={{ marginTop: 0 }}>
                Connect your <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">Strava API app</a>. Stored only in this browser's localStorage.
              </p>
              <div className="form-field">
                <label className="form-label">Client ID</label>
                <input className="form-input" type="text" placeholder="e.g. 12345" autoComplete="off" value={stravaCid} onChange={(e) => setStravaCid(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Client Secret</label>
                <input className="form-input" type="password" placeholder="abc123…" autoComplete="off" value={stravaCsecret} onChange={(e) => setStravaCsecret(e.target.value)} />
              </div>
            </div>
          )}
          <button className="btn-strava" onClick={() => connectStrava(stravaCustomChecked ? { clientId: stravaCid, clientSecret: stravaCsecret } : undefined)}>
            <Icon name="directions_run" size={14} /> Connect Strava
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>Connected{stravaAthleteName() ? ` as ${stravaAthleteName()}` : ''}</span>
            <button className="link-btn" onClick={async () => { await disconnectStrava(); refresh() }}>Disconnect</button>
          </div>
          <p className="setup-note" style={{ marginBottom: 10 }}>Last synced: {formatTimeAgo(stravaLastSync())}</p>
          <button className="btn-strava" onClick={handleStravaSync} disabled={stravaSyncing}>
            <Icon name="sync" size={14} /> {stravaSyncing ? 'Syncing…' : 'Force Sync Now'}
          </button>
          <div className="toggle-row" style={{ marginTop: 14 }}>
            <div>
              <div className="toggle-row-label">Pause sync</div>
              <div className="toggle-row-sub">Stop importing new activities from Strava</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={stravaSyncPaused()} onChange={(e) => { saveSetting('strava_sync_paused', e.target.checked); refresh() }} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-row-label">Auto push to Strava</div>
              <div className="toggle-row-sub">Manual entries: {stravaAutoPushManual ? 'on' : 'off'} · Google Health imports: {stravaAutoPushGoogle ? 'on' : 'off'}</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={stravaAutoPushManual || stravaAutoPushGoogle}
                onChange={(e) => { saveSetting('strava_auto_push', e.target.checked); saveSetting('strava_auto_push_google', e.target.checked); refresh() }} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-row-label">Sync weight</div>
              <div className="toggle-row-sub">Update Strava athlete weight when you log a weight entry</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={stravaWeightSyncEnabled()} onChange={(e) => { setStravaWeightSync(e.target.checked); refresh() }} />
              <span className="toggle-slider" />
            </label>
          </div>
          <button className="link-btn" style={{ marginTop: 14, color: 'var(--danger)', display: 'block' }} onClick={handleRemoveStrava}>Remove all synced activities</button>
        </div>
      )}

      <div className="settings-section-divider" />

      <div className="integration-label"><Icon name="favorite" size={14} /> Google Health</div>
      {!ghConnected ? (
        <div>
          <p className="setup-note">Connect your Google Health account to sync activities.</p>
          <div className="toggle-row" style={{ marginBottom: 4 }}>
            <div className="toggle-row-label" style={{ fontSize: 13 }}>Use custom API credentials (self-hosted)</div>
            <label className="toggle-switch">
              <input type="checkbox" checked={ghCustomChecked} onChange={(e) => setGhCustomChecked(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          {ghCustomChecked && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--track)', borderRadius: 8 }}>
              <p className="setup-note" style={{ marginTop: 0 }}>
                Sync via the <a href="https://console.cloud.google.com/apis/api/health.googleapis.com/" target="_blank" rel="noopener">Google Health API Console</a>. Stored only in this browser's localStorage.
              </p>
              <p className="setup-note" style={{ marginTop: 0 }}>
                Redirect URI: <code style={{ fontSize: 11, background: 'var(--bg)', padding: '1px 4px', borderRadius: 4, wordBreak: 'break-all' }}>{location.origin + location.pathname}</code>
              </p>
              <div className="form-field">
                <label className="form-label">Client ID</label>
                <input className="form-input" type="text" placeholder="123….apps.googleusercontent.com" autoComplete="off" value={ghCid} onChange={(e) => setGhCid(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Client Secret</label>
                <input className="form-input" type="password" placeholder="GOCSPX-…" autoComplete="off" value={ghCsecret} onChange={(e) => setGhCsecret(e.target.value)} />
              </div>
            </div>
          )}
          <button className="btn-google-health" onClick={() => connectGoogleHealth(ghCustomChecked ? { clientId: ghCid, clientSecret: ghCsecret } : undefined)}>
            <Icon name="favorite" size={14} /> Connect with Google
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{googleHealthUserName() || 'Connected'}</span>
            <button className="link-btn" onClick={async () => { await disconnectGoogleHealth(); refresh() }}>Disconnect</button>
          </div>
          <p className="setup-note" style={{ marginBottom: 10 }}>Last synced: {formatTimeAgo(googleHealthLastSync())}</p>
          <button className="btn-google-health" onClick={handleGhSync} disabled={ghSyncing}>
            <Icon name="sync" size={14} /> {ghSyncing ? 'Syncing…' : 'Force Sync Now'}
          </button>
          <div className="toggle-row" style={{ marginTop: 14 }}>
            <div>
              <div className="toggle-row-label">Pause sync</div>
              <div className="toggle-row-sub">Stop importing new activities from Google Health</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={ghSyncPaused()} onChange={(e) => { saveSetting('gh_sync_paused', e.target.checked); refresh() }} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-row-label">Auto push to Google Health</div>
              <div className="toggle-row-sub">Manual entries: {ghAutoPushManual ? 'on' : 'off'} · Strava imports: {ghAutoPushStrava ? 'on' : 'off'}</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={ghAutoPushManual || ghAutoPushStrava}
                onChange={(e) => { saveSetting('gh_auto_push', e.target.checked); saveSetting('gh_push_strava', e.target.checked); refresh() }} />
              <span className="toggle-slider" />
            </label>
          </div>
          <button className="link-btn" style={{ marginTop: 14, color: 'var(--danger)', display: 'block' }} onClick={handleRemoveGh}>Remove all synced activities</button>
        </div>
      )}

      <div className="settings-section-divider" />

      <div className="integration-label"><Icon name="swap_horiz" size={14} /> Activity Conflicts</div>
      <p className="setup-note">When Strava and Google Health overlap, only the selected source counts toward metrics. You can swap any inactive duplicate from its card.</p>
      <div className="form-field" style={{ marginBottom: 16 }}>
        <label className="form-label">Default source</label>
        <select className="form-input" value={getWorkoutConflictPreference()} onChange={(e) => { setWorkoutConflictPreference(e.target.value); refresh() }}>
          <option value="strava">Strava</option>
          <option value="google-health">Google Health</option>
        </select>
      </div>

      <button className="btn-primary" onClick={closeSheet}>Done</button>
    </Sheet>
  )
}

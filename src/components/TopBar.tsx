import { useAppStore } from '../store'
import { openSettingsSheet } from '../lib/sheets'
import { syncStrava, stravaIsConnected } from '../lib/strava'
import { syncGoogleHealth, googleHealthIsConnected } from '../lib/google-health'
import { db, supabase, isDemo } from '../lib/db'
import { showToast } from '../lib/toast'
import { clearFailed } from '../lib/sync-status'
import Icon from './Icon'

async function handleDisableDemo() {
  if (!confirm('Exit demo mode?')) return
  await supabase.auth.signOut()
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('tracker-theme', next)
}

async function syncAll() {
  clearFailed()
  db.bust()
  const results = await Promise.all([
    stravaIsConnected() ? syncStrava().catch(() => 0) : 0,
    googleHealthIsConnected() ? syncGoogleHealth().catch(() => 0) : 0,
  ])
  const total = results.reduce((s: number, n) => s + (n || 0), 0)
  showToast(total ? `Synced ${total} new activities` : 'All up to date')
}

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'activities', label: 'Activities' },
  { id: 'nutrition', label: 'Nutrition' },
] as const

export default function TopBar() {
  const activeTab = useAppStore((s) => s.activeTab)
  const syncCounts = useAppStore((s) => s.syncCounts)
  const syncFailed = useAppStore((s) => s.syncFailed)

  const syncingNames = Object.keys(syncCounts)
  const isSyncing = syncingNames.length > 0
  const hasFailed = syncFailed.size > 0
  const syncLabel = isSyncing
    ? `Syncing ${syncingNames.join(' · ')}…`
    : hasFailed ? `${[...syncFailed].join(' · ')} sync failed` : ''

  function switchTab(tab: typeof TABS[number]['id']) {
    useAppStore.setState({ activeTab: tab })
    localStorage.setItem('tracker-tab', tab)
  }

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <span className="top-bar-title">
          <img src="/brand/svg/logo-mono-light.svg" alt="MyTracker" className="app-icon app-icon-light" />
          <img src="/brand/svg/logo-mono-dark.svg" alt="MyTracker" className="app-icon app-icon-dark" />
          MyTracker
        </span>
        {isDemo && (
          <span className="settings-version settings-version-demo top-bar-demo-badge" data-tip="Tap to exit demo mode" aria-label="Demo mode" onClick={handleDisableDemo}>
            Demo
          </span>
        )}
        {(isSyncing || hasFailed) && (
          <div id="sync-status" aria-live="polite" style={hasFailed && !isSyncing ? { color: 'var(--warn)' } : undefined}>
            <span className={`sync-dot${hasFailed && !isSyncing ? ' sync-dot--failed' : ''}`} />
            <span className="sync-label">{syncLabel}</span>
          </div>
        )}
        <div className="top-bar-actions">
          <button id="refresh-btn" className={`icon-btn${isSyncing ? ' spinning' : ''}`} aria-label="Sync all" onClick={syncAll}>
            <Icon name="sync" size={18} />
          </button>
          <button className="icon-btn" aria-label="Toggle dark mode" onClick={toggleTheme}>
            <Icon name="light_mode" size={18} className="icon-sun" />
            <Icon name="dark_mode" size={18} className="icon-moon" />
          </button>
          <button className="icon-btn" aria-label="Settings" onClick={openSettingsSheet}>
            <Icon name="settings" size={18} />
          </button>
        </div>
      </div>
      <div className="top-bar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  )
}

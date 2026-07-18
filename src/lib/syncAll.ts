import { db } from './db'
import { syncStrava, stravaIsConnected } from './strava'
import { syncGoogleHealth, googleHealthIsConnected } from './google-health'
import { clearFailed } from './sync-status'
import { showToast } from './toast'

// Force-refresh: reload from Supabase and pull any new Strava/Google Health
// activities. Shared by the Settings sync button and the pull-to-refresh
// gesture on each tab.
export async function syncAll() {
  clearFailed()
  db.bust()
  const results = await Promise.all([
    stravaIsConnected() ? syncStrava().catch(() => 0) : 0,
    googleHealthIsConnected() ? syncGoogleHealth().catch(() => 0) : 0,
  ])
  const total = results.reduce((s: number, n) => s + (n || 0), 0)
  showToast(total ? `Synced ${total} new activities` : 'All up to date')
}

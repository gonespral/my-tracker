import { useEffect, useRef, useState } from 'react'
import { supabase, isDemo } from './lib/db'
import { useAppInit } from './lib/useAppInit'
import { useViewportKeyboard } from './lib/useViewportKeyboard'
import { useAppStore } from './store'
import SignInOverlay from './components/SignInOverlay'
import TopBar from './components/TopBar'
import ChartTooltip from './components/ChartTooltip'
import Backdrop from './components/Backdrop'
import FoodSheet from './components/sheets/FoodSheet'
import ActivitySheet from './components/sheets/ActivitySheet'
import WeightSheet from './components/sheets/WeightSheet'
import IntegrationsSheet from './components/sheets/IntegrationsSheet'
import ApiKeySheet from './components/sheets/ApiKeySheet'
import SettingsSheet from './components/sheets/SettingsSheet'
import MealPresetSheet from './components/sheets/MealPresetSheet'
import WorkoutPresetSheet from './components/sheets/WorkoutPresetSheet'
import Tutorial from './components/Tutorial'
import ChatPanel from './components/ChatPanel'
import InputBar from './components/InputBar'
import TodayTab from './tabs/Today'
import NutritionTab from './tabs/Nutrition'
import ActivitiesTab from './tabs/Activities'
import PullToRefresh from './components/PullToRefresh'
import { handleStravaCallback, syncStrava, stravaIsConnected } from './lib/strava'
import { handleGoogleHealthCallback, syncGoogleHealth, googleHealthIsConnected } from './lib/google-health'
import { restoreChatIfFresh } from './lib/ai'
import { showToast } from './lib/toast'
import { syncAll } from './lib/syncAll'

function useAuth() {
  const [ready, setReady] = useState(isDemo)
  const currentUser = useAppStore((s) => s.currentUser)

  useEffect(() => {
    if (isDemo) return // db.ts already seeds a fake currentUser in demo mode

    supabase.auth.getSession().then(({ data: { session } }) => {
      useAppStore.setState({ currentUser: session?.user ?? null })
      setReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      useAppStore.setState({ currentUser: session?.user ?? null, dbCache: null })
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  return { ready, currentUser }
}

// No persistent top bar left to host a "Syncing…" indicator, so background
// sync results surface as toasts instead: silent when nothing new comes in
// (the common case, every 60s), a toast when new activities land, and a
// toast on failure.
function runBackgroundSync() {
  if (stravaIsConnected()) {
    syncStrava()
      .then((n) => { if (n) showToast(`Synced ${n} new ${n === 1 ? 'activity' : 'activities'} from Strava`) })
      .catch((e) => { console.warn('Strava sync:', e); showToast('Strava sync failed') })
  }
  if (googleHealthIsConnected()) {
    syncGoogleHealth()
      .then((n) => { if (n) showToast(`Synced ${n} new ${n === 1 ? 'activity' : 'activities'} from Google Health`) })
      .catch((e) => { console.warn('GH sync:', e); showToast('Google Health sync failed') })
  }
}

// Handles Strava/Google Health OAuth redirect callbacks once, then kicks off
// background sync (immediately + every 60s) for whichever integrations are
// already connected — mirrors the old app.js bootstrap sequence.
function useIntegrationSync(currentUser: unknown) {
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    ;(async () => {
      await handleStravaCallback()
      await handleGoogleHealthCallback()
      if (cancelled) return
      runBackgroundSync()
    })()

    const interval = setInterval(runBackgroundSync, 60000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [currentUser])
}

// Restores a persisted chat session once per app load (the first time a user
// is known), not on every Supabase auth-state event — a token refresh mid-
// conversation must not clobber the in-memory chat with an older snapshot.
function useRestoreChatOnce(currentUser: unknown) {
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!currentUser || restoredRef.current) return
    restoredRef.current = true
    restoreChatIfFresh()
  }, [currentUser])
}

export default function App() {
  const { ready, currentUser } = useAuth()
  const activeTab = useAppStore((s) => s.activeTab)
  useAppInit(currentUser as { id: string } | null)
  useIntegrationSync(currentUser)
  useRestoreChatOnce(currentUser)
  useViewportKeyboard()

  if (!ready) return null

  if (!currentUser) {
    return <SignInOverlay />
  }

  return (
    <div id="app">
      <TopBar />
      <main className="panels">
        <div className={`panel ${activeTab === 'today' ? 'active' : ''}`} id="panel-today">
          {activeTab === 'today' && <PullToRefresh onRefresh={syncAll}><TodayTab /></PullToRefresh>}
        </div>
        <div className={`panel ${activeTab === 'nutrition' ? 'active' : ''}`} id="panel-nutrition">
          {activeTab === 'nutrition' && <PullToRefresh onRefresh={syncAll}><NutritionTab /></PullToRefresh>}
        </div>
        <div className={`panel ${activeTab === 'activities' ? 'active' : ''}`} id="panel-activities">
          {activeTab === 'activities' && <PullToRefresh onRefresh={syncAll}><ActivitiesTab /></PullToRefresh>}
        </div>
      </main>
      <div className="toast" id="toast" />
      <ChartTooltip />
      <Backdrop />
      <FoodSheet />
      <ActivitySheet />
      <WeightSheet />
      <IntegrationsSheet />
      <ApiKeySheet />
      <SettingsSheet />
      <MealPresetSheet />
      <WorkoutPresetSheet />
      <Tutorial />
      <ChatPanel />
      <InputBar />
    </div>
  )
}

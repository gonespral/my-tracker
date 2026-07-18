import { useAppStore } from '../store'
import { openSettingsSheet } from '../lib/sheets'
import { isDemo, supabase } from '../lib/db'
import { dateStr, fmtDateShort } from '../lib/utils'
import Icon from './Icon'

async function handleDisableDemo() {
  if (!confirm('Exit demo mode?')) return
  await supabase.auth.signOut()
}

const TABS = [
  { id: 'today', label: 'Daily' },
  { id: 'activities', label: 'Activities' },
  { id: 'nutrition', label: 'Nutrition' },
] as const

export default function TopBar() {
  const activeTab = useAppStore((s) => s.activeTab)
  const dailyDate = useAppStore((s) => s.dailyDate)

  const todayStr = dateStr()
  const isToday = !dailyDate || dailyDate === todayStr
  const navLabel = isToday ? 'Today' : fmtDateShort(dailyDate!)

  function goDay(delta: number) {
    const cur = dailyDate ?? todayStr
    const d = new Date(cur + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const next = dateStr(d)
    useAppStore.setState({ dailyDate: next >= todayStr ? null : next })
  }

  function switchTab(tab: typeof TABS[number]['id']) {
    useAppStore.setState({ activeTab: tab })
    localStorage.setItem('tracker-tab', tab)
  }

  return (
    <header className="top-bar">
      {isDemo && (
        <div className="top-bar-status-row">
          <span className="settings-version settings-version-demo" data-tip="Tap to exit demo mode" aria-label="Demo mode" onClick={handleDisableDemo}>
            Demo
          </span>
        </div>
      )}
      <div className="top-bar-tabrow">
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
        <button className="icon-btn top-bar-settings-btn" aria-label="Settings" onClick={openSettingsSheet}>
          <Icon name="settings" size={20} />
        </button>
      </div>
      {activeTab === 'today' && (
        <div className="date-nav">
          <button className="hm-nav-btn" aria-label="Previous day" onClick={() => goDay(-1)}>
            <Icon name="chevron_left" size={22} />
          </button>
          <span
            className={`date-nav-label${isToday ? '' : ' date-nav-label--past'}`}
            onClick={isToday ? undefined : () => useAppStore.setState({ dailyDate: null })}
          >{navLabel}</span>
          <button className="hm-nav-btn" aria-label="Next day" disabled={isToday} onClick={() => goDay(1)}>
            <Icon name="chevron_right" size={22} />
          </button>
        </div>
      )}
    </header>
  )
}

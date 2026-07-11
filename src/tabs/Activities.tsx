import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { dateStr, type WorkoutEntry } from '../lib/utils'
import { openActivitySheet } from '../lib/sheets'
import { useAppStore } from '../store'
import type { DbCache } from '../store'
import MonthNav from '../components/MonthNav'
import MonthHeatmap from '../components/charts/MonthHeatmap'
import IntensityTrend from '../components/charts/IntensityTrend'
import ActivityStats from '../components/charts/ActivityStats'
import ActivityTypeBreakdown from '../components/charts/ActivityTypeBreakdown'
import Streak from '../components/charts/Streak'
import { ActivityItem, ActivityStack, groupActivitiesByConflict } from '../components/ActivityItem'
import Icon from '../components/Icon'

export default function ActivitiesTab() {
  const [data, setData] = useState<DbCache | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const monthOffset = useAppStore((s) => s.heatmapMonthOffset)
  const expandedGroups = useAppStore((s) => s.expandedConflictGroups)
  const dataGen = useAppStore((s) => s.dataGen)

  function reload() {
    db.bust()
  }

  useEffect(() => {
    db.load().then(setData)
  }, [dataGen])

  if (!data) return <div className="panel-inner">Loading…</div>

  const today = dateStr()
  const ref = new Date()
  ref.setDate(1)
  ref.setMonth(ref.getMonth() + monthOffset)
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const feedDays: { ds: string; ws: WorkoutEntry[]; isToday: boolean; d: Date }[] = []
  for (let day = daysInMonth; day >= 1; day--) {
    const d = new Date(year, month, day)
    const ds = dateStr(d)
    const ws = data.workouts[ds] || []
    const isToday = ds === today
    if (isToday || ws.length > 0) feedDays.push({ ds, ws, isToday, d })
  }

  const workoutDays = Object.keys(data.workouts || {}).filter((ds) => {
    const [y, m] = ds.split('-').map(Number)
    return y === year && m === month + 1 && (data.workouts[ds] || []).some((w) => !w.isDuplicate)
  }).length

  function toggleGroup(groupId: string) {
    const next = new Set(expandedGroups)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    useAppStore.setState({ expandedConflictGroups: next })
  }

  function gotoDate(ds: string) {
    document.querySelector(`.workout-day-group[data-date="${ds}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="panel-inner">
      <div className="panel-left">
        <MonthNav />
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Activities</span>
            <span className="chart-sub">{workoutDays} total</span>
          </div>
          <MonthHeatmap data={data} monthOffset={monthOffset} type="workouts" onDayClick={gotoDate} />
        </div>
        <button className="stats-toggle" onClick={() => setStatsOpen((s) => !s)}>
          <span className="panel-toggle-label">{statsOpen ? 'Hide stats' : 'Stats'}</span>
          <Icon name={statsOpen ? 'expand_less' : 'expand_more'} size={16} className="panel-toggle-arrow" />
        </button>
        {/* Kept mounted (inline display, not conditional render): desktop CSS
            force-shows .stats-section and hides .stats-toggle, so the section
            must exist in the DOM even while "collapsed". */}
        <div className="stats-section" style={{ display: statsOpen ? 'block' : 'none' }}>
          <div className="chart-card"><ActivityTypeBreakdown data={data} year={year} month={month} /></div>
          <div className="streak-card"><Streak data={data} /></div>
          <div className="section-divider" />
          <div className="section-label">Last 30 days</div>
          <div className="chart-card"><ActivityStats data={data} nDays={30} /></div>
          <div className="chart-card" style={{ marginTop: 12 }}><IntensityTrend data={data} nDays={30} /></div>
        </div>
      </div>
      <div className="panel-right">
        <button className="log-add-btn" style={{ marginBottom: 16 }} onClick={() => openActivitySheet(today)}>+ Log activity</button>
        {feedDays.length ? feedDays.map(({ ds, ws, isToday, d }, i) => {
          const label = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
          return (
            <div className="anim-item" style={{ '--anim-delay': `${(i * 0.06).toFixed(2)}s` } as React.CSSProperties} key={ds}>
              <div className="workout-day-group" data-date={ds}>
                <div className={`workout-day-hd${isToday ? ' today-hd' : ''}`}>{label}</div>
                {groupActivitiesByConflict(ws).map((item) =>
                  item.type === 'stack'
                    ? <ActivityStack key={item.groupId} entries={item.entries} expanded={expandedGroups.has(item.groupId)} onToggle={() => toggleGroup(item.groupId)} onChanged={reload} />
                    : <ActivityItem key={item.entry.id} entry={item.entry} onChanged={reload} />
                )}
              </div>
            </div>
          )
        }) : <div className="empty">No activities this month.</div>}
      </div>
    </div>
  )
}

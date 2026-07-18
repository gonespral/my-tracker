import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { dateStr, sumFood, fmt, round, type FoodEntry } from '../lib/utils'
import { openFoodSheet, openEditWeightSheet, openWeightSheet } from '../lib/sheets'
import { useAppStore } from '../store'
import type { DbCache } from '../store'
import MonthHeatmap from '../components/charts/MonthHeatmap'
import WeekChart from '../components/charts/WeekChart'
import CalorieTrend from '../components/charts/CalorieTrend'
import MealMacroAvg from '../components/charts/MealMacroAvg'
import Sparkline from '../components/charts/Sparkline'
import FoodItem from '../components/FoodItem'
import EntryMenu from '../components/EntryMenu'
import Icon from '../components/Icon'

function WeightSection({ weights, onChanged }: { weights: { date: string; kg: number }[]; onChanged: () => void }) {
  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date))
  if (!sorted.length) {
    return <button className="log-add-btn" onClick={() => openWeightSheet()}>+ Log today's weight</button>
  }
  const shown = sorted.slice(0, 3)

  async function handleDelete(date: string) {
    await db.deleteWeight(date)
    onChanged()
  }

  return (
    <>
      <button className="log-add-btn" style={{ marginBottom: 12 }} onClick={() => openWeightSheet()}>+ Log today's weight</button>
      <Sparkline weights={sorted} compact />
      {shown.map((w, i) => {
        const prev = sorted[i + 1]
        const delta = prev ? w.kg - prev.kg : null
        const cls = delta === null ? '' : delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'same'
        return (
          <div className="weight-entry" key={w.date}>
            <div className="weight-entry-date">{new Date(`${w.date}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div className="weight-entry-right">
              {delta !== null && <span className={`delta ${cls}`}>{delta > 0 ? '+' : ''}{delta.toFixed(2)} kg</span>}
              <div className="weight-entry-kg">{w.kg.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--tx3)' }}> kg</span></div>
            </div>
            <EntryMenu>
              <button onClick={() => openEditWeightSheet(w)}>Edit</button>
              <button className="danger" onClick={() => handleDelete(w.date)}>Delete</button>
            </EntryMenu>
          </div>
        )
      })}
      {sorted.length > 3 && <div className="empty" style={{ padding: '8px 0' }}>{sorted.length - 3} older entries not shown</div>}
    </>
  )
}

export default function NutritionTab() {
  const [data, setData] = useState<DbCache | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const monthOffset = useAppStore((s) => s.heatmapMonthOffset)
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

  const feedDays: { ds: string; food: FoodEntry[]; isToday: boolean; d: Date }[] = []
  for (let day = daysInMonth; day >= 1; day--) {
    const d = new Date(year, month, day)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    const isToday = ds === today
    if (food.length > 0 || isToday) feedDays.push({ ds, food, isToday, d })
  }

  const foodDays = Object.keys(data.food || {}).filter((ds) => {
    const [y, m] = ds.split('-').map(Number)
    return y === year && m === month + 1 && (data.food[ds] || []).length > 0
  }).length

  function gotoDate(ds: string) {
    document.querySelector(`.workout-day-group[data-date="${ds}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="panel-inner">
      <div className="panel-left">
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Nutrition</span>
            <span className="chart-sub">{foodDays} day{foodDays !== 1 ? 's' : ''} logged</span>
          </div>
          <MonthHeatmap data={data} monthOffset={monthOffset} type="nutrition" onDayClick={gotoDate} />
        </div>
        <button className="stats-toggle" onClick={() => setStatsOpen((s) => !s)}>
          <span className="panel-toggle-label">{statsOpen ? 'Hide stats' : 'Stats'}</span>
          <Icon name={statsOpen ? 'expand_less' : 'expand_more'} size={16} className="panel-toggle-arrow" />
        </button>
        {/* Kept mounted (inline display, not conditional render): desktop CSS
            force-shows .stats-section and hides .stats-toggle, so the section
            must exist in the DOM even while "collapsed". */}
        <div className="stats-section" style={{ display: statsOpen ? 'block' : 'none' }}>
          <div className="chart-card"><WeekChart data={data} /></div>
          <div className="section-divider" />
          <div className="section-label">Last 30 days</div>
          <div className="chart-card"><CalorieTrend data={data} nDays={30} title="Caloric intake" primary="input" /></div>
          <div className="chart-card"><MealMacroAvg data={data} nDays={30} /></div>
        </div>
        <div className="section-label">Weight</div>
        <WeightSection weights={data.weights || []} onChanged={reload} />
      </div>
      <div className="panel-right">
        <button className="log-add-btn" style={{ marginBottom: 16 }} onClick={() => openFoodSheet(today)}>+ Log food</button>
        {feedDays.length ? feedDays.map(({ ds, food, isToday, d }, i) => {
          const label = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
          const totals = sumFood(food)
          return (
            <div className="anim-item" style={{ '--anim-delay': `${(i * 0.06).toFixed(2)}s` } as React.CSSProperties} key={ds}>
              <div className="workout-day-group" data-date={ds}>
                <div className={`workout-day-hd${isToday ? ' today-hd' : ''}`}>
                  {label}{' '}
                  {food.length > 0 && (
                    <span className="nutrition-day-macro">{round(totals.calories)} kcal · P{fmt(totals.protein)}g · C{fmt(totals.carbs)}g · F{fmt(totals.fat)}g</span>
                  )}
                </div>
                {food.map((e) => <FoodItem key={e.id} entry={e} onDeleted={reload} />)}
              </div>
            </div>
          )
        }) : <div className="empty">No food logged this month.</div>}
      </div>
    </div>
  )
}

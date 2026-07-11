import { ACTIVITY_TYPE, detectActivityType } from '../../lib/config'
import { typeIconName } from '../../lib/icons'
import type { WorkoutEntry } from '../../lib/utils'
import type { DbCache } from '../../store'
import Icon from '../Icon'

export default function ActivityTypeBreakdown({ data, year, month }: { data: DbCache; year: number; month: number }) {
  const counts: Record<string, number> = {}
  let total = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    for (const w of (data.workouts[ds] || []) as WorkoutEntry[]) {
      if (w.isDuplicate) continue
      const type = w.activity_type || detectActivityType(w.description)
      counts[type] = (counts[type] || 0) + 1
      total++
    }
  }

  if (!total) return <div className="empty" style={{ padding: '8px 0' }}>No activities yet.</div>

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <>
      <div className="chart-header">
        <span className="chart-title">By type</span>
        <span className="chart-sub">{total} total</span>
      </div>
      {sorted.map(([type, count]) => {
        const info = ACTIVITY_TYPE[type] || ACTIVITY_TYPE.lift
        const pct = Math.round((count / total) * 100)
        return (
          <div className="type-bar-row" key={type}>
            <div className="type-bar-icon"><Icon name={typeIconName(type)} size={15} /></div>
            <div className="type-bar-label">{info.label}</div>
            <div className="type-bar-track">
              <div className="type-bar-fill" style={{ width: `${pct}%`, background: info.color }} />
            </div>
            <div className="type-bar-count">{count}</div>
          </div>
        )
      })}
    </>
  )
}

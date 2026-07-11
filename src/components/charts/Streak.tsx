import type { CSSProperties } from 'react'
import { dateStr } from '../../lib/utils'
import type { DbCache } from '../../store'

export default function Streak({ data }: { data: DbCache }) {
  const todayStr = dateStr()
  const now = new Date()

  // Monday of the current week
  const dow = now.getDay() // 0=Sun
  const mondayOffset = (dow + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayOffset)

  // Count consecutive active weeks going back from current week
  // A week counts even if only partially elapsed (current week)
  let weekStreak = 0
  for (let w = 0; w < 52; w++) {
    const weekMon = new Date(monday)
    weekMon.setDate(monday.getDate() - w * 7)
    // For current week check only days up to today; past weeks check all 7
    const daysToCheck = w === 0 ? mondayOffset + 1 : 7
    let active = false
    for (let d = 0; d < daysToCheck; d++) {
      const day = new Date(weekMon)
      day.setDate(weekMon.getDate() + d)
      if ((data.workouts[dateStr(day)] || []).length > 0) { active = true; break }
    }
    if (active) weekStreak++
    else break
  }

  // Dots for Mon–Sun of current week
  const dots = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const ds = dateStr(day)
    const isFuture = ds > todayStr
    const isToday = ds === todayStr
    const has = !isFuture && (data.workouts[ds] || []).length > 0
    const lbl = day.toLocaleDateString('en-US', { weekday: 'narrow' })
    dots.push({ ds, isFuture, isToday, has, lbl, i })
  }

  return (
    <>
      <div className="streak-number-wrap">
        <div className="streak-number">{weekStreak}</div>
        <div className="streak-label">week activity streak</div>
      </div>
      <div className="streak-dots">
        {dots.map((d) => (
          <div className="streak-dot-wrap" style={{ '--anim-delay': `${(d.i * 0.05).toFixed(2)}s` } as CSSProperties} key={d.ds}>
            <div className={`streak-dot ${d.has ? 'filled' : ''} ${d.isToday ? 'today' : ''} ${d.isFuture ? 'future' : ''}`}>
              {d.has && (
                <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="dot-day-label">{d.lbl}</div>
          </div>
        ))}
      </div>
    </>
  )
}

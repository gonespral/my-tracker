import { dateStr, calculateNetActiveCalories, round, type WorkoutEntry } from '../../lib/utils'
import type { DbCache } from '../../store'

export default function ActivityStats({ data, nDays = 30 }: { data: DbCache; nDays?: number }) {
  let sessions = 0, totalCal = 0, totalDist = 0, distCount = 0
  let totalHR = 0, hrCount = 0, totalDur = 0, durCount = 0
  for (let i = 0; i < nDays; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const dayWorkouts: WorkoutEntry[] = data.workouts[ds] || []
    totalCal += calculateNetActiveCalories(dayWorkouts)
    for (const w of dayWorkouts) {
      if (w.isDuplicate) continue
      sessions++
      if (w.duration_min) { totalDur += w.duration_min; durCount++ }
      if (w.distance_km) { totalDist += w.distance_km; distCount++ }
      if (w.heart_rate_avg) { totalHR += w.heart_rate_avg; hrCount++ }
    }
  }

  const stats: { label: string; value: string | number; unit: string }[] = [
    { label: 'Sessions', value: sessions, unit: '' },
    { label: 'Avg cal burned/workout', value: sessions ? round(totalCal / sessions) : '—', unit: sessions ? ' kcal' : '' },
  ]
  if (durCount > 0) stats.push({ label: 'Avg duration', value: Math.round(totalDur / durCount), unit: ' min' })
  if (distCount > 0) stats.push({ label: 'Total distance', value: totalDist.toFixed(2), unit: ' km' })
  if (hrCount > 0) stats.push({ label: 'Avg heart rate', value: Math.round(totalHR / hrCount), unit: ' bpm' })

  return (
    <div className="activity-stats-grid">
      {stats.slice(0, 3).map((s) => (
        <div className="activity-stat" key={s.label}>
          <div className="activity-stat-val">{s.value}<span className="activity-stat-unit">{s.unit}</span></div>
          <div className="activity-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

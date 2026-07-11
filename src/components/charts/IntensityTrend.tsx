import { dateStr, round, type WorkoutEntry } from '../../lib/utils'
import type { DbCache } from '../../store'

export default function IntensityTrend({ data, nDays = 30 }: { data: DbCache; nDays?: number }) {
  const today = dateStr()
  const days: { ds: string; d: Date; intensity: number | null; totalCal: number; totalDur: number; isToday: boolean }[] = []
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const workouts: WorkoutEntry[] = (data.workouts[ds] || []).filter((w) => !w.isDuplicate && w.duration_min && w.calories_burned)
    let intensity: number | null = null, totalCal = 0, totalDur = 0
    if (workouts.length) {
      totalCal = workouts.reduce((s, w) => s + (w.calories_burned || 0), 0)
      totalDur = workouts.reduce((s, w) => s + (w.duration_min || 0), 0)
      intensity = totalDur > 0 ? totalCal / totalDur : null
    }
    days.push({ ds, d, intensity, totalCal, totalDur, isToday: ds === today })
  }

  const W = 320, H = 108, PL = 30, PR = 8, PT = 10, PB = 24
  const cW = W - PL - PR, cH = H - PT - PB
  const maxIntensity = Math.max(...days.map((d) => d.intensity || 0), 8)
  const xStep = cW / (days.length - 1 || 1)
  const bW = Math.max(cW / nDays * 0.55, 2)

  const tierColor = (v: number) => (v >= 10 ? 'var(--danger)' : v >= 6 ? 'var(--warn)' : 'var(--accent)')

  const active = days.filter((d) => d.intensity != null)
  const avg = active.length ? round(active.reduce((s, d) => s + (d.intensity || 0), 0) / active.length) : 0

  return (
    <>
      <div className="chart-header">
        <span className="chart-title">Workout intensity</span>
        <span className="chart-sub">{avg ? `${avg} kcal/min avg` : 'No data'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="week-svg chart-fade-in">
        <text x={PL - 4} y={(PT + cH + 3).toFixed(1)} textAnchor="end" fontSize={8} fill="var(--tx3)">0</text>
        <line x1={PL} y1={(PT + cH).toFixed(1)} x2={(W - PR).toFixed(1)} y2={(PT + cH).toFixed(1)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.6} />
        {days.map((day, i) => {
          if (day.intensity == null) return null
          const x = PL + i * xStep - bW / 2
          const bH = Math.max((day.intensity / maxIntensity) * cH, 2)
          const y = PT + cH - bH
          const hitX = PL + i * xStep - xStep / 2
          const tip = `<strong>${day.d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>`
            + `<span class="ct-sub">${round(day.intensity)} kcal/min · ${round(day.totalCal)} kcal / ${round(day.totalDur)} min</span>`
          return (
            <g key={day.ds}>
              <rect className="chart-hit" x={hitX.toFixed(1)} y={PT} width={xStep.toFixed(1)} height={cH} fill="transparent" data-tip={tip} />
              <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bW.toFixed(1)} height={bH.toFixed(1)} rx={2}
                fill={tierColor(day.intensity)} opacity={day.isToday ? 1 : 0.85}
                style={{ pointerEvents: 'none', animation: `anim-fade-in 0.4s ease both ${(i * 0.01).toFixed(2)}s` }} />
            </g>
          )
        })}
        {days.map((day, i) => {
          if (day.d.getDate() !== 1 && day.d.getDate() !== 15) return null
          const x = PL + i * xStep
          return (
            <text key={day.ds} x={x.toFixed(1)} y={(H - 8).toFixed(1)} textAnchor="middle" dominantBaseline="hanging" fontSize={8} fill="var(--tx3)">
              {day.d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />Light</span>
        <span style={{ fontSize: 9, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', display: 'inline-block' }} />Moderate</span>
        <span style={{ fontSize: 9, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />Intense</span>
      </div>
    </>
  )
}

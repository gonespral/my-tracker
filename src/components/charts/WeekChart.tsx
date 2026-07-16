import { TARGETS } from '../../lib/config'
import { dateStr, sumFood, round, calculateNetActiveCalories, detectFoodOutliers } from '../../lib/utils'
import type { DbCache } from '../../store'

interface DayBar {
  ds: string
  isToday: boolean
  cals: number
  target: number
  label: string
  dateLabel: string
  isOutlier: boolean
}

export default function WeekChart({ data }: { data: DbCache }) {
  const W = 320, H = 120, PL = 30, PR = 8, PT = 14, PB = 24
  const cW = W - PL - PR, cH = H - PT - PB
  const today = dateStr()
  const outliers = detectFoodOutliers(data, 90)

  const days: DayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    const workouts = data.workouts[ds] || []
    const dayBurn = calculateNetActiveCalories(workouts)
    const eatbackPct = TARGETS.calories.eatback_enabled !== false ? (TARGETS.calories.eatback_pct ?? 50) : 0
    const dayEatback = dayBurn > 0 ? Math.round(dayBurn * eatbackPct / 100) : 0
    days.push({
      ds, isToday: ds === today,
      cals: sumFood(food).calories,
      target: (TARGETS.calories.goal || TARGETS.calories.rest) + dayEatback,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOutlier: outliers.has(ds),
    })
  }

  const calGoal = TARGETS.calories.goal || TARGETS.calories.rest
  const maxCal = Math.max(...days.map(d => Math.max(d.cals, d.target)), calGoal * 1.1, 100)
  const goalTargetY = PT + (1 - calGoal / maxCal) * cH
  const bW = cW / 7 * 0.6
  const bStep = cW / 7

  const validDays = days.filter(d => d.cals > 0 && !d.isOutlier)
  const wkAvg = round(validDays.reduce((s, d) => s + d.cals, 0) / Math.max(validDays.length, 1))
  const hasWeekOutliers = days.some(d => d.isOutlier)

  return (
    <>
      <div className="chart-header">
        <span className="chart-title">This week</span>
        <span className="chart-sub">avg {wkAvg.toLocaleString()} kcal/day{hasWeekOutliers ? ' · excl. incomplete' : ''}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="week-svg">
        <text x={PL - 4} y={(goalTargetY + 3).toFixed(1)} textAnchor="end" fontSize={8} fill="var(--tx3)">{Math.round(calGoal)}</text>
        <text x={PL - 4} y={(PT + cH + 3).toFixed(1)} textAnchor="end" fontSize={8} fill="var(--tx3)">0</text>
        <line x1={PL} y1={goalTargetY.toFixed(1)} x2={(W - PR).toFixed(1)} y2={goalTargetY.toFixed(1)} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />
        {days.map((d, i) => {
          const bH = d.cals > 0 ? Math.max((d.cals / maxCal) * cH, 3) : 0
          const x = PL + i * bStep + (bStep - bW) / 2
          const y = PT + cH - bH
          const pct = d.cals / d.target
          const fill = d.isOutlier ? 'var(--tx3)'
            : d.cals === 0 ? 'var(--track)'
            : pct > 1.1 ? 'var(--danger)'
            : 'var(--accent)'
          const opacity = d.isOutlier ? 0.35 : d.cals === 0 ? 1 : 0.85
          const labelFill = d.isToday ? 'var(--tx)' : 'var(--tx3)'
          const delay = `${(i * 0.06).toFixed(2)}s`
          const tip = `<strong>${d.dateLabel}</strong><span class="ct-sub">${Math.round(d.cals)} / ${Math.round(d.target)} kcal</span>`
          return (
            <g className="bar-group" style={{ '--bar-delay': delay } as React.CSSProperties} key={d.ds}>
              <rect className="chart-hit" x={x.toFixed(1)} y={PT} width={bW.toFixed(1)} height={cH} fill="transparent" data-tip={tip} />
              <rect className="bar-rect" x={x.toFixed(1)} y={y.toFixed(1)} width={bW.toFixed(1)} height={bH.toFixed(1)}
                fill={fill} rx={4} opacity={opacity} style={{ pointerEvents: 'none' }} />
              <text x={(x + bW / 2).toFixed(1)} y={(H - 6).toFixed(1)} textAnchor="middle"
                fontSize={9} fill={labelFill} fontWeight={d.isToday ? 700 : 400}>{d.label}</text>
              {d.cals > 0 && (
                <text className="bar-cal-label" x={(x + bW / 2).toFixed(1)} y={(y - 4).toFixed(1)} textAnchor="middle"
                  fontSize={8} fill={fill} fontWeight={600} style={{ pointerEvents: 'none' }}>{Math.round(d.cals)}</text>
              )}
              {d.isOutlier && (
                <text x={(x + bW / 2).toFixed(1)} y={(y - 4).toFixed(1)} textAnchor="middle"
                  fontSize={8} fill="var(--tx3)" opacity={0.6}>?</text>
              )}
            </g>
          )
        })}
      </svg>
    </>
  )
}

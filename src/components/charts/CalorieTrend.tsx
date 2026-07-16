import { TARGETS } from '../../lib/config'
import { dateStr, sumFood, calculateNetActiveCalories, detectFoodOutliers, round, type FoodEntry, type WorkoutEntry } from '../../lib/utils'
import type { DbCache } from '../../store'

interface TrendDay {
  ds: string
  primary: number | null
  secondary: number | null
  isOutlier: boolean
  d: Date
  isToday: boolean
}

interface Pt {
  x: number
  primaryY: number | null
  outlierY: number | null
  secondaryY: number | null
  date: Date
  isToday: boolean
  isOutlier: boolean
}

export default function CalorieTrend({ data, nDays = 30, title, primary = 'input' }: {
  data: DbCache
  nDays?: number
  title?: string
  primary?: 'input' | 'burned'
}) {
  const today = dateStr()
  const outliers = detectFoodOutliers(data, Math.max(nDays, 90))
  const eatbackPct = TARGETS.calories.eatback_enabled !== false ? (TARGETS.calories.eatback_pct ?? 50) : 0

  const isBurnedPrimary = primary === 'burned'
  const days: TrendDay[] = []
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)

    const workouts: WorkoutEntry[] = data.workouts[ds] || []
    const burned = calculateNetActiveCalories(workouts)
    const eatback = burned > 0 ? Math.round(burned * eatbackPct / 100) : 0
    const tdee = (TARGETS.calories.goal || TARGETS.calories.rest) + eatback

    const foodItems: FoodEntry[] = data.food[ds] || []
    const input = foodItems.length > 0 ? sumFood(foodItems).calories : null

    days.push({
      ds,
      primary: isBurnedPrimary ? tdee : input,
      secondary: isBurnedPrimary ? input : tdee,
      isOutlier: outliers.has(ds),
      d,
      isToday: ds === today,
    })
  }

  const chartTitle = title || (isBurnedPrimary ? 'Calorie burn' : 'Caloric intake')
  const primaryColor = isBurnedPrimary ? '#f97316' : 'var(--accent)'
  const secondaryColor = isBurnedPrimary ? 'var(--accent)' : '#f97316'

  const W = 320, H = 108, PL = 30, PR = 8, PT = 10, PB = 24
  const cW = W - PL - PR, cH = H - PT - PB
  const dataMax = Math.max(...days.map((d) => Math.max(d.primary || 0, d.secondary || 0)), 0)
  const maxCal = Math.max(Math.max(dataMax, TARGETS.calories.goal || TARGETS.calories.rest) * 1.1, 100)
  const tY = (v: number) => {
    const clamped = Math.max(0, Math.min(v, maxCal))
    return PT + (1 - clamped / maxCal) * cH
  }
  const xStep = cW / (days.length - 1)

  const pts: Pt[] = days.map((day, i) => {
    const rawY = day.primary && day.primary > 0 ? tY(day.primary) : null
    return {
      x: PL + i * xStep,
      primaryY: rawY !== null && !day.isOutlier ? rawY : null,
      outlierY: rawY !== null && day.isOutlier ? rawY : null,
      secondaryY: day.secondary && day.secondary > 0 ? tY(day.secondary) : null,
      date: day.d,
      isToday: day.isToday,
      isOutlier: day.isOutlier,
    }
  })

  const primaryPaths: string[] = [], primaryAreaPaths: string[] = []
  let primarySeg = ''
  let currentSegmentPts: Pt[] = []
  const secondaryPaths: string[] = []
  let secondarySeg = ''

  for (const p of pts) {
    if (p.primaryY !== null) {
      primarySeg += (primarySeg ? ' L' : 'M') + `${p.x.toFixed(1)},${p.primaryY.toFixed(1)}`
      currentSegmentPts.push(p)
    } else if (primarySeg) {
      primaryPaths.push(primarySeg)
      if (currentSegmentPts.length >= 2) {
        primaryAreaPaths.push(
          primarySeg +
          ` L${currentSegmentPts[currentSegmentPts.length - 1].x.toFixed(1)},${(PT + cH).toFixed(1)}` +
          ` L${currentSegmentPts[0].x.toFixed(1)},${(PT + cH).toFixed(1)} Z`
        )
      }
      primarySeg = ''
      currentSegmentPts = []
    }

    if (p.secondaryY !== null) {
      secondarySeg += (secondarySeg ? ' L' : 'M') + `${p.x.toFixed(1)},${p.secondaryY.toFixed(1)}`
    } else if (secondarySeg) {
      secondaryPaths.push(secondarySeg)
      secondarySeg = ''
    }
  }
  if (primarySeg) {
    primaryPaths.push(primarySeg)
    if (currentSegmentPts.length >= 2) {
      primaryAreaPaths.push(
        primarySeg +
        ` L${currentSegmentPts[currentSegmentPts.length - 1].x.toFixed(1)},${(PT + cH).toFixed(1)}` +
        ` L${currentSegmentPts[0].x.toFixed(1)},${(PT + cH).toFixed(1)} Z`
      )
    }
  }
  if (secondarySeg) secondaryPaths.push(secondarySeg)

  const todayPt = pts[pts.length - 1]

  const ticks = pts.filter((p) => p.date.getDate() === 1 || p.date.getDate() === 15)

  const validDays = days.filter((d) => d.primary && d.primary > 0 && d.secondary && d.secondary > 0 && !d.isOutlier)
  let diffText: string | null = null
  let diffColor = ''
  if (validDays.length > 0) {
    const totalBurn = validDays.reduce((s, d) => s + (isBurnedPrimary ? d.primary! : d.secondary!), 0)
    const totalInput = validDays.reduce((s, d) => s + (isBurnedPrimary ? d.secondary! : d.primary!), 0)
    const avgDiff = Math.round((totalInput - totalBurn) / validDays.length)
    if (Math.abs(avgDiff) > 10) {
      diffText = avgDiff > 0 ? `+${avgDiff.toLocaleString()} surplus/day` : `${Math.abs(avgDiff).toLocaleString()} deficit/day`
      diffColor = avgDiff > 0 ? 'var(--danger)' : 'var(--accent)'
    } else {
      diffText = 'Balanced avg'
      diffColor = ''
    }
  }

  const uid = chartTitle.replace(/\W+/g, '').toLowerCase().slice(0, 14)

  const trendPayload = {
    primaryLabel: isBurnedPrimary ? 'Burned' : 'Input',
    secondaryLabel: isBurnedPrimary ? 'Input' : 'Burned',
    days: pts.map((p, i) => ({
      x: p.x,
      primaryY: p.primaryY,
      secondaryY: p.secondaryY,
      label: p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      primary: days[i].primary != null ? round(days[i].primary!) : null,
      secondary: days[i].secondary != null ? round(days[i].secondary!) : null,
    })),
  }

  return (
    <>
      <div className="chart-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="chart-title" style={{ marginBottom: 0 }}>{chartTitle}</span>
          {diffText && (
            <span style={{ padding: '2px 6px', borderRadius: 4, background: diffColor ? `${diffColor}15` : 'var(--track)', color: diffColor || 'var(--tx2)', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>
              {diffText}
            </span>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="week-svg chart-fade-in">
        <defs>
          <linearGradient id={`cal-grad-primary-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={primaryColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={primaryColor} stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id={`cal-grad-secondary-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={secondaryColor} stopOpacity={0.1} />
            <stop offset="100%" stopColor={secondaryColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <text x={PL - 4} y={(PT + cH + 3).toFixed(1)} textAnchor="end" fontSize={8} fill="var(--tx3)">0</text>
        <line x1={PL} y1={(PT + cH).toFixed(1)} x2={(W - PR).toFixed(1)} y2={(PT + cH).toFixed(1)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.6} />
        {primaryAreaPaths.map((area, i) => (
          <path key={`pa${i}`} d={area} fill={`url(#cal-grad-primary-${uid})`} style={{ animation: 'anim-fade-in 0.6s ease both 0.3s' }} />
        ))}
        {secondaryPaths.map((p, i) => (
          <path key={`sp${i}`} d={p} fill="none" stroke={secondaryColor} strokeWidth={1.6} strokeOpacity={0.55} strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'anim-fade-in 0.5s ease both 0.2s' }} />
        ))}
        {primaryPaths.map((p, i) => (
          <path key={`pp${i}`} d={p} fill="none" stroke={primaryColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'anim-fade-in 0.5s ease both 0.1s' }} />
        ))}
        {pts.filter((p) => p.outlierY !== null).map((p, i) => (
          <circle key={`o${i}`} cx={p.x.toFixed(1)} cy={p.outlierY!.toFixed(1)} r={2.5} fill="var(--tx3)" fillOpacity={0.3} stroke="var(--tx3)" strokeWidth={1} strokeOpacity={0.5} style={{ animation: 'dot-pop 0.3s ease both 0.4s' }} />
        ))}
        {todayPt.primaryY !== null && (
          <circle cx={todayPt.x.toFixed(1)} cy={todayPt.primaryY.toFixed(1)} r={3} fill={primaryColor} style={{ animation: 'dot-pop 0.3s ease both 0.85s' }} />
        )}
        {todayPt.secondaryY !== null && (
          <circle cx={todayPt.x.toFixed(1)} cy={todayPt.secondaryY.toFixed(1)} r={2.5} fill={secondaryColor} fillOpacity={0.45} style={{ animation: 'dot-pop 0.3s ease both 0.95s' }} />
        )}
        {ticks.map((p, i) => (
          <text key={i} x={p.x.toFixed(1)} y={(H - 8).toFixed(1)} textAnchor="middle" dominantBaseline="hanging" fontSize={8} fill="var(--tx3)">
            {p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
        <line className="trend-cursor-line" x1={0} y1={PT} x2={0} y2={PT + cH} style={{ display: 'none' }} />
        <circle className="trend-cursor-dot" data-series="primary" r={3} fill={primaryColor} style={{ display: 'none' }} />
        <circle className="trend-cursor-dot" data-series="secondary" r={2.5} fill={secondaryColor} style={{ display: 'none' }} />
        <rect className="trend-hit" x={PL} y={PT} width={cW} height={cH} fill="transparent" style={{ pointerEvents: 'all' }} data-trend={JSON.stringify(trendPayload)} />
      </svg>
    </>
  )
}

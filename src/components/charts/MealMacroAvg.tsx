import { MEAL_ORDER, MEAL_LABEL } from '../../lib/config'
import { MACRO_COLORS } from '../../lib/chartColors'
import { dateStr, sumFood, detectFoodOutliers, fmt, type FoodEntry } from '../../lib/utils'
import type { DbCache } from '../../store'

const MEAL_KEYS = [...MEAL_ORDER, 'uncategorised']
const SEGMENTS = [
  { key: 'protein' as const, label: 'Protein', color: MACRO_COLORS.protein },
  { key: 'carbs' as const, label: 'Carbs', color: MACRO_COLORS.carbs },
  { key: 'fat' as const, label: 'Fat', color: MACRO_COLORS.fat },
]

interface MacroAvg { calories: number; protein: number; carbs: number; fat: number }

export default function MealMacroAvg({ data, nDays = 30 }: { data: DbCache; nDays?: number }) {
  const outliers = detectFoodOutliers(data, Math.max(nDays, 90))
  const totals: Record<string, MacroAvg> = Object.fromEntries(MEAL_KEYS.map((m) => [m, { calories: 0, protein: 0, carbs: 0, fat: 0 }]))
  const dayCounts: Record<string, number> = Object.fromEntries(MEAL_KEYS.map((m) => [m, 0]))

  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    if (outliers.has(ds)) continue
    const grouped: Record<string, FoodEntry[]> = {}
    for (const entry of data.food[ds] || []) {
      const meal = entry.meal || 'uncategorised'
      ;(grouped[meal] = grouped[meal] || []).push(entry)
    }
    for (const meal of MEAL_KEYS) {
      if (!grouped[meal]?.length) continue
      dayCounts[meal]++
      const dayTotals = sumFood(grouped[meal])
      totals[meal].calories += dayTotals.calories
      totals[meal].protein += dayTotals.protein
      totals[meal].carbs += dayTotals.carbs
      totals[meal].fat += dayTotals.fat
    }
  }

  const averages = MEAL_KEYS.map((meal) => {
    const dc = dayCounts[meal]
    const avg: MacroAvg = dc > 0
      ? { calories: totals[meal].calories / dc, protein: totals[meal].protein / dc, carbs: totals[meal].carbs / dc, fat: totals[meal].fat / dc }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 }
    return {
      meal,
      label: MEAL_LABEL[meal] || (meal === 'uncategorised' ? 'Other' : meal),
      avg,
      totalMacros: avg.protein + avg.carbs + avg.fat,
      dayCount: dc,
    }
  }).filter((row) => row.dayCount > 0)

  if (!averages.length) return <div className="empty">No nutrition data yet.</div>

  const maxStack = Math.max(...averages.map((row) => row.totalMacros), 1)

  return (
    <>
      <div className="chart-header">
        <span className="chart-title">Macros intake</span>
        <span className="chart-sub">Stacked grams</span>
      </div>
      <div className="meal-macro-chart">
        {averages.map((row, i) => {
          const macrosSummary = `P${fmt(row.avg.protein)} · C${fmt(row.avg.carbs)} · F${fmt(row.avg.fat)}`
          const barH = Math.round((row.totalMacros / maxStack) * 90)
          const delay = `${(i * 0.07).toFixed(2)}s`
          return (
            <div className="meal-macro-col" key={row.meal} style={{ '--bar-delay': delay } as React.CSSProperties}>
              <div className="meal-macro-kcal" style={{ animation: 'bar-label-in 0.2s ease both', animationDelay: `calc(${delay} + 0.3s)` }}>{fmt(row.avg.calories)} kcal</div>
              <div className="meal-macro-bar macro-bar-rise" style={{ height: barH }}>
                {SEGMENTS.map((seg, idx) => {
                  const val = row.avg[seg.key]
                  if (val <= 0) return null
                  const radius = idx === 0 ? '0 0 8px 8px' : idx === SEGMENTS.length - 1 ? '8px 8px 0 0' : undefined
                  const tip = `<strong>${seg.label}</strong><span class="ct-sub">${fmt(val)}g</span>`
                  return (
                    <div key={seg.key} className={`meal-macro-seg meal-macro-${seg.key}`} data-tip={tip} style={{ flex: val, background: seg.color, borderRadius: radius }} />
                  )
                })}
              </div>
              <div className="meal-macro-label">{row.label}</div>
              <div className="meal-macro-detail">{macrosSummary}</div>
            </div>
          )
        })}
      </div>
      <div className="meal-macro-legend">
        {SEGMENTS.map((seg) => (
          <div className="meal-macro-legend-item" key={seg.key}>
            <span className="meal-macro-legend-swatch" style={{ background: seg.color }} />
            {seg.label}
          </div>
        ))}
      </div>
    </>
  )
}

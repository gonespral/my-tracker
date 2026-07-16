import { TARGETS, detectActivityType } from '../../lib/config'
import { typeIconName } from '../../lib/icons'
import { dateStr, sumFood, detectFoodOutliers, type WorkoutEntry } from '../../lib/utils'
import type { DbCache } from '../../store'
import Icon from '../Icon'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function parseCssColor(value?: string | null) {
  const color = String(value || '').trim()
  if (!color) return null
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    const raw = hex[1]
    const expand = (s: string) => (s.length === 1 ? s + s : s)
    if (raw.length === 3 || raw.length === 4) {
      return { r: parseInt(expand(raw[0]), 16), g: parseInt(expand(raw[1]), 16), b: parseInt(expand(raw[2]), 16) }
    }
    if (raw.length === 6 || raw.length === 8) {
      return { r: parseInt(raw.slice(0, 2), 16), g: parseInt(raw.slice(2, 4), 16), b: parseInt(raw.slice(4, 6), 16) }
    }
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => p.trim())
    if (parts.length >= 3) return { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]) }
  }
  return null
}

function mixRgbColors(base: { r: number; g: number; b: number }, accent: { r: number; g: number; b: number }, ratio: number) {
  const t = clamp(ratio, 0, 1)
  const r = Math.round(base.r + (accent.r - base.r) * t)
  const g = Math.round(base.g + (accent.g - base.g) * t)
  const b = Math.round(base.b + (accent.b - base.b) * t)
  return `rgb(${r} ${g} ${b})`
}

function nutritionHeatmapStyle(diff: number, target: number) {
  const rootStyles = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const accent = parseCssColor(rootStyles?.getPropertyValue('--accent')) || { r: 29, g: 122, b: 58 }
  const track = parseCssColor(rootStyles?.getPropertyValue('--track')) || { r: 233, g: 236, b: 242 }

  const absDiff = Math.abs(diff)
  const onTargetWindow = Math.max(50, target * 0.25)
  const scale = Math.max(target * 0.8, 400)
  const closeness = absDiff <= onTargetWindow ? 1 : clamp(1 - (absDiff - onTargetWindow) / scale, 0.12, 1)
  const background = mixRgbColors(track, accent, closeness)
  const color = closeness > 0.7 ? '#fff' : 'var(--tx)'
  return { background, color, onTargetWindow }
}

export default function MonthHeatmap({ data, monthOffset = 0, type = 'workouts', onDayClick }: {
  data: DbCache
  monthOffset?: number
  type?: 'workouts' | 'nutrition'
  onDayClick?: (date: string) => void
}) {
  const outliers = type === 'nutrition' ? detectFoodOutliers(data, 180) : new Set<string>()
  const now = new Date()
  now.setDate(1)
  now.setMonth(now.getMonth() + monthOffset)
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = dateStr()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7

  const cells: React.ReactNode[] = []
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} className="hm-cell hm-empty" />)

  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = ds === today
    const isFuture = ds > today
    let cls = 'hm-cell'
    if (isToday) cls += ' hm-today'
    if (isFuture) cls += ' hm-future'

    if (type === 'workouts') {
      const dayWorkouts: WorkoutEntry[] = data.workouts[ds] || []
      const hasWorkout = dayWorkouts.some((w) => !w.isDuplicate)
      if (hasWorkout) {
        cls += ' hm-has'
        const w = dayWorkouts[0]
        const wtype = w.activity_type || detectActivityType(w.description)
        const subParts: string[] = []
        if (w.duration_min) subParts.push(`${w.duration_min} min`)
        if (w.calories_burned) subParts.push(`${Math.round(w.calories_burned)} kcal`)
        if (dayWorkouts.length > 1) subParts.push(`+${dayWorkouts.length - 1} more`)
        const tip = `<strong>${w.description}</strong>` + (subParts.length ? `<span class="ct-sub">${subParts.join(' · ')}</span>` : '')
        cells.push(
          <div key={ds} className={cls} style={{ cursor: 'pointer' }} onClick={() => onDayClick?.(ds)} data-tip={tip}>
            <Icon name={typeIconName(wtype)} size={13} />
          </div>
        )
      } else {
        cells.push(<div key={ds} className={cls}>{isFuture ? '' : day}</div>)
      }
    } else {
      const food = data.food[ds] || []
      if (food.length > 0 && outliers.has(ds)) {
        cls += ' hm-has hm-outlier'
        const tip = `<strong>Incomplete logging</strong><span class="ct-sub">Excluded from averages</span>`
        cells.push(
          <div key={ds} className={`${cls} hm-nutrition`} style={{ cursor: 'pointer' }} onClick={() => onDayClick?.(ds)} data-tip={tip}>
            <span className="hm-day">{day}</span><span className="hm-arrow" style={{ opacity: 0.5 }}>?</span>
          </div>
        )
      } else if (food.length > 0) {
        const input = sumFood(food).calories
        const tdee = TARGETS.calories.goal || TARGETS.calories.rest
        const diff = input - tdee
        const { background, color, onTargetWindow } = nutritionHeatmapStyle(diff, tdee)
        const absDiff = Math.abs(diff)
        const arrow = absDiff <= onTargetWindow ? '✓' : diff > 0 ? '↑' : '↓'
        const diffLabel = absDiff <= onTargetWindow
          ? `On target (${Math.round(input)} / ${Math.round(tdee)} kcal)`
          : `${Math.round(absDiff)} kcal ${diff > 0 ? 'surplus' : 'deficit'} (${Math.round(input)} / ${Math.round(tdee)} kcal)`
        cls += ' hm-has'
        const tip = `<strong>${diffLabel}</strong>`
        cells.push(
          <div key={ds} className={`${cls} hm-nutrition`} style={{ cursor: 'pointer', background, color }} onClick={() => onDayClick?.(ds)} data-tip={tip}>
            <span className="hm-day">{day}</span><span className="hm-arrow">{arrow}</span>
          </div>
        )
      } else {
        cells.push(<div key={ds} className={cls}>{isFuture ? '' : day}</div>)
      }
    }
  }

  return (
    <>
      <div className="heatmap-dow">{DAY_LABELS.map((l, i) => <div key={i} className="hm-label">{l}</div>)}</div>
      <div className="heatmap-grid">{cells}</div>
    </>
  )
}

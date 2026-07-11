import { useAppStore } from '../store'

export default function MonthNav() {
  const monthOffset = useAppStore((s) => s.heatmapMonthOffset)
  const now = new Date()
  now.setDate(1)
  now.setMonth(now.getMonth() + monthOffset)
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const canGoNext = monthOffset < 0

  return (
    <div className="hm-nav-row" style={{ alignItems: 'center', marginBottom: 12 }}>
      <button type="button" className="hm-nav-btn" onClick={() => useAppStore.setState({ heatmapMonthOffset: monthOffset - 1 })}>‹</button>
      <div className="hm-nav-title" style={{ fontSize: 14, fontWeight: 600 }}>{monthName}</div>
      <button type="button" className="hm-nav-btn" disabled={!canGoNext} onClick={() => useAppStore.setState({ heatmapMonthOffset: monthOffset + 1 })}>›</button>
    </div>
  )
}

interface WeightPoint {
  date: string
  kg: number
}

export default function Sparkline({ weights, compact = false }: { weights: WeightPoint[]; compact?: boolean }) {
  if (weights.length < 2) return null
  const ordered = [...weights].reverse()
  const vals = ordered.map(w => w.kg)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = maxV - minV || 0.5

  // compact=true → left column (~300px); compact=false → right/wide column (~700px+)
  // viewBox width is chosen so font-size:8 renders at ~8-10px in each context
  const W = compact ? 380 : 700, H = 80
  const LPAD = 38, RPAD = 8, TPAD = 10, BPAD = 10
  const chartW = W - LPAD - RPAD
  const chartH = H - TPAD - BPAD

  const xStep = chartW / (vals.length - 1 || 1)
  const pts = vals.map((v, i) => ({
    x: LPAD + i * xStep,
    y: TPAD + (1 - (v - minV) / range) * chartH,
  }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = line + ` L${pts[pts.length - 1].x.toFixed(1)},${TPAD + chartH} L${pts[0].x.toFixed(1)},${TPAD + chartH} Z`

  const midV = (minV + maxV) / 2
  const ticks = range > 0.01
    ? [{ v: maxV, y: TPAD }, { v: midV, y: TPAD + chartH / 2 }, { v: minV, y: TPAD + chartH }]
    : [{ v: minV, y: TPAD + chartH / 2 }]

  const uid = 'wgt'
  return (
    <div className="sparkline-card">
      <div className="chart-header">
        <span className="chart-title">Weight trend</span>
        <span className="chart-sub">{ordered.length} entries · {minV.toFixed(2)}–{maxV.toFixed(2)} kg</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id={`wg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={LPAD} y1={t.y.toFixed(1)} x2={W - RPAD} y2={t.y.toFixed(1)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />
            <text x={LPAD - 5} y={t.y.toFixed(1)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="var(--tx3)">{t.v.toFixed(1)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#wg-${uid})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => {
          const w = ordered[i]
          const dateLabel = w.date ? new Date(w.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
          const tip = `<strong>${w.kg.toFixed(2)} kg</strong>${dateLabel ? `<span class="ct-sub">${dateLabel}</span>` : ''}`
          return (
            <g key={i}>
              <circle className="chart-hit" cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={7} fill="transparent" data-tip={tip} />
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={3} fill="var(--accent)" style={{ pointerEvents: 'none' }} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

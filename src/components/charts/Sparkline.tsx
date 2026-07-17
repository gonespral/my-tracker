import { useEffect, useRef, useState } from 'react'

interface WeightPoint { date: string; kg: number }

const MS = 86_400_000

export default function Sparkline({ weights, compact = false }: { weights: WeightPoint[]; compact?: boolean }) {
  // Hooks first — unconditionally
  const initNow  = useRef(Date.now())
  const [viewStart, setViewStart] = useState(() => initNow.current - 30 * MS)
  const [viewEnd,   setViewEnd]   = useState(() => initNow.current + MS * 0.5)

  const svgRef  = useRef<SVGSVGElement>(null)
  const ptrs    = useRef(new Map<number, number>()) // id → clientX
  const gesture = useRef<
    | { type: 'pan';   startCX: number; vsStart: number; veStart: number }
    | { type: 'pinch'; startDist: number; centerSvgX: number; vsStart: number; veStart: number }
    | null
  >(null)

  // Always-fresh snapshot for the non-passive wheel handler
  const snap = useRef({ vs: viewStart, ve: viewEnd, dataMin: 0, dataMax: 0 })
  snap.current.vs = viewStart
  snap.current.ve = viewEnd

  const W = compact ? 380 : 700
  const H = 92
  const LPAD = 38, RPAD = 8, TPAD = 10, BPAD = 22
  const chartW = W - LPAD - RPAD
  const chartH = H - TPAD - BPAD
  const uid = compact ? 'wgt-c' : 'wgt-w'

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { vs, ve, dataMin, dataMax } = snap.current
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
      const rect   = el.getBoundingClientRect()
      const px     = ((e.clientX - rect.left) / rect.width) * W
      applyZoom(px, factor, vs, ve, dataMin, dataMax)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [W]) // W only changes if compact changes, which doesn't happen at runtime

  // Early return after hooks
  if (!weights.length) return null

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const allTs  = sorted.map(w => +new Date(w.date + 'T00:00'))
  const allKg  = sorted.map(w => w.kg)

  const dataMin = allTs[0]
  const dataMax = allTs[allTs.length - 1]
  snap.current.dataMin = dataMin
  snap.current.dataMax = dataMax

  // ── coordinate helpers ────────────────────────────────────────────────

  function applyZoom(pivotSvgX: number, factor: number, vs: number, ve: number, dMin: number, dMax: number) {
    const range     = ve - vs
    const newRange  = Math.max(3 * MS, Math.min(730 * MS, range * factor))
    const pivotFrac = Math.max(0, Math.min(1, (pivotSvgX - LPAD) / chartW))
    const pivotTs   = vs + pivotFrac * range
    const margin    = 3 * MS
    let s = pivotTs - pivotFrac * newRange
    let e = s + newRange
    if (e > dMax + margin) { e = dMax + margin; s = e - newRange }
    if (s < dMin - margin) { s = dMin - margin; e = s + newRange }
    setViewStart(s)
    setViewEnd(e)
  }

  function applyPan(deltaClientX: number, vsStart: number, veStart: number, dMin: number, dMax: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const range   = veStart - vsStart
    const deltaTs = -(deltaClientX / rect.width) * W / chartW * range
    const margin  = 3 * MS
    let s = vsStart + deltaTs
    let e = veStart + deltaTs
    if (e > dMax + margin) { e = dMax + margin; s = e - range }
    if (s < dMin - margin) { s = dMin - margin; e = s + range }
    setViewStart(s)
    setViewEnd(e)
  }

  const xFromTs = (ts: number) => LPAD + (ts - viewStart) / (viewEnd - viewStart) * chartW

  // Y range from visible points only
  const buf   = (viewEnd - viewStart) * 0.1
  const visKg = sorted.filter((_, i) => allTs[i] >= viewStart - buf && allTs[i] <= viewEnd + buf).map(w => w.kg)
  const yKg   = visKg.length ? visKg : allKg
  const minV  = Math.min(...yKg)
  const maxV  = Math.max(...yKg)
  const yRange = (maxV - minV) || 0.5
  const yPad   = yRange * 0.15
  const yFromKg = (kg: number) => TPAD + (1 - (kg - minV + yPad) / (yRange + 2 * yPad)) * chartH

  // Points in the render window (one full span of buffer for smooth panning)
  const span = viewEnd - viewStart
  const pts  = sorted
    .map((w, i) => ({ w, ts: allTs[i], x: xFromTs(allTs[i]), y: yFromKg(w.kg) }))
    .filter(p => p.ts >= viewStart - span && p.ts <= viewEnd + span)

  let linePath = '', areaPath = ''
  if (pts.length >= 2) {
    linePath = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1], first = pts[0]
    areaPath = `${linePath} L${last.x.toFixed(1)},${(TPAD + chartH).toFixed(1)} L${first.x.toFixed(1)},${(TPAD + chartH).toFixed(1)} Z`
  }

  // ── Y axis ────────────────────────────────────────────────────────────
  const yTicks = yRange > 0.01
    ? [maxV, (minV + maxV) / 2, minV].map(v => ({ v, y: yFromKg(v) }))
    : [{ v: minV, y: yFromKg(minV) }]

  // ── X axis ────────────────────────────────────────────────────────────
  const viewMs  = viewEnd - viewStart
  const tickMs  = viewMs <=  14 * MS ? MS : viewMs <=  60 * MS ? 7 * MS : viewMs <= 180 * MS ? 14 * MS : 30 * MS
  const firstTs = Math.ceil(viewStart / tickMs) * tickMs
  const xTicks: { x: number; label: string }[] = []
  for (let ts = firstTs; ts <= viewEnd; ts += tickMs) {
    const x = xFromTs(ts)
    if (x >= LPAD + 2 && x <= W - RPAD - 2) {
      xTicks.push({ x, label: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
    }
  }

  // ── Gesture handlers ──────────────────────────────────────────────────
  function getSvgX(clientX: number) {
    const r = svgRef.current?.getBoundingClientRect()
    return r ? ((clientX - r.left) / r.width) * W : 0
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, e.clientX)
    const px = [...ptrs.current.values()]
    if (px.length === 1) {
      gesture.current = { type: 'pan', startCX: e.clientX, vsStart: viewStart, veStart: viewEnd }
    } else if (px.length === 2) {
      gesture.current = {
        type: 'pinch',
        startDist: Math.max(Math.abs(px[0] - px[1]), 1),
        centerSvgX: getSvgX((px[0] + px[1]) / 2),
        vsStart: viewStart,
        veStart: viewEnd,
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    ptrs.current.set(e.pointerId, e.clientX)
    const px = [...ptrs.current.values()]
    const g  = gesture.current
    if (!g) return

    if (g.type === 'pan' && px.length === 1) {
      applyPan(e.clientX - g.startCX, g.vsStart, g.veStart, dataMin, dataMax)
    } else if (g.type === 'pinch' && px.length >= 2) {
      // Factor relative to STARTING state so incremental moves stay smooth
      const dist   = Math.max(Math.abs(px[0] - px[1]), 1)
      const factor = g.startDist / dist
      applyZoom(g.centerSvgX, factor, g.vsStart, g.veStart, dataMin, dataMax)
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size === 0) {
      gesture.current = null
    } else if (ptrs.current.size === 1 && gesture.current?.type === 'pinch') {
      const [rx] = [...ptrs.current.values()]
      gesture.current = { type: 'pan', startCX: rx, vsStart: viewStart, veStart: viewEnd }
    }
  }

  // ── Header label ──────────────────────────────────────────────────────
  const fmt = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const at30d = Math.abs(viewStart - (initNow.current - 30 * MS)) < MS
  const subLabel = at30d ? 'last 30 days' : `${fmt(viewStart)} – ${fmt(viewEnd)}`

  return (
    <div className="sparkline-card">
      <div className="chart-header">
        <span className="chart-title">Weight trend</span>
        <span className="chart-sub">{sorted.length} entries · {subLabel}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%', height: 'auto', display: 'block',
          touchAction: 'none', cursor: 'grab',
          userSelect: 'none', WebkitUserSelect: 'none',
        } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <clipPath id={`clip-${uid}`}>
            <rect x={LPAD} y={0} width={chartW} height={H} />
          </clipPath>
          <linearGradient id={`grad-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={LPAD} y1={t.y.toFixed(1)} x2={W - RPAD} y2={t.y.toFixed(1)}
              stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />
            <text x={LPAD - 5} y={t.y.toFixed(1)} textAnchor="end" dominantBaseline="middle"
              fontSize={8} fill="var(--tx3)">{t.v.toFixed(1)}</text>
          </g>
        ))}

        {/* X-axis date ticks */}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x.toFixed(1)} y1={(TPAD + chartH).toFixed(1)}
              x2={t.x.toFixed(1)} y2={(TPAD + chartH + 3).toFixed(1)}
              stroke="var(--border)" strokeWidth={1} />
            <text x={t.x.toFixed(1)} y={(TPAD + chartH + 5).toFixed(1)}
              textAnchor="middle" dominantBaseline="hanging" fontSize={7} fill="var(--tx3)">
              {t.label}
            </text>
          </g>
        ))}

        {/* Data line + fill + dots (clipped to chart area) */}
        <g clipPath={`url(#clip-${uid})`}>
          {areaPath && <path d={areaPath} fill={`url(#grad-${uid})`} />}
          {linePath && (
            <path d={linePath} fill="none" stroke="var(--accent)"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {pts.map((p, i) => {
            const label = new Date(p.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const tip   = `<strong>${p.w.kg.toFixed(2)} kg</strong><span class="ct-sub">${label}</span>`
            return (
              <g key={i}>
                <circle className="chart-hit" cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                  r={7} fill="transparent" data-tip={tip} />
                <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                  r={3} fill="var(--accent)" style={{ pointerEvents: 'none' }} />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

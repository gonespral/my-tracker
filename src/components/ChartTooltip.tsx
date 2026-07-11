import { useEffect, useRef, useState } from 'react'

interface TrendDay {
  x: number
  primaryY: number | null
  secondaryY: number | null
  label: string
  primary: number | null
  secondary: number | null
}

interface TrendPayload {
  primaryLabel: string
  secondaryLabel: string
  days: TrendDay[]
}

interface TooltipState {
  html: string
  x: number
  y: number
}

// Delegated hover handling for any element carrying a `data-tip` (innerHTML
// string) attribute — chart elements and the top-bar icon buttons alike —
// plus continuous crosshair hover for trend-line charts via `.trend-hit`
// elements carrying a `data-trend` JSON payload. Delegated at the document
// level — rendered once for the whole app — since this markup mounts and
// unmounts constantly as tabs/data change. The tooltip appears immediately
// on hover and tracks the pointer with no delay, matching the old `ui.js`.
export default function ChartTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null)
  const elRef = useRef<HTMLDivElement>(null)
  const activeTargetRef = useRef<Element | null>(null)

  useEffect(() => {
    function handleOver(e: PointerEvent) {
      const target = (e.target as Element).closest('[data-tip]') as HTMLElement | null
      if (!target) return
      activeTargetRef.current = target
      setTip({ html: target.dataset.tip!, x: e.clientX, y: e.clientY })
    }

    function handleMove(e: PointerEvent) {
      const trendHit = (e.target as Element).closest('.trend-hit') as HTMLElement | null
      if (trendHit) {
        activeTargetRef.current = trendHit
        handleTrendHover(trendHit, e.clientX, e.clientY)
        return
      }

      const tipTarget = (e.target as Element).closest('[data-tip]')
      if (!tipTarget || activeTargetRef.current !== tipTarget) return
      setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))
    }

    function handleOut(e: PointerEvent) {
      const target = (e.target as Element).closest('[data-tip], .trend-hit') as Element | null
      if (!target) return
      if (e.relatedTarget && target.contains(e.relatedTarget as Node)) return
      activeTargetRef.current = null
      setTip(null)
      if (target.classList.contains('trend-hit')) hideTrendCursor(target)
    }

    function handleTrendHover(hitEl: HTMLElement, clientX: number, clientY: number) {
      let payload: TrendPayload
      try { payload = JSON.parse(hitEl.dataset.trend!) } catch { return }
      const svg = hitEl.closest('svg')
      if (!svg || !payload.days?.length) return

      const rect = svg.getBoundingClientRect()
      const vb = svg.viewBox.baseVal
      const svgX = (clientX - rect.left) / rect.width * vb.width

      let nearest = payload.days[0], minDist = Infinity
      for (const d of payload.days) {
        const dist = Math.abs(d.x - svgX)
        if (dist < minDist) { minDist = dist; nearest = d }
      }

      const cursorLine = svg.querySelector('.trend-cursor-line')
      if (cursorLine) {
        cursorLine.setAttribute('x1', String(nearest.x))
        cursorLine.setAttribute('x2', String(nearest.x))
        ;(cursorLine as SVGElement).style.display = 'block'
      }
      const [primaryDot, secondaryDot] = svg.querySelectorAll('.trend-cursor-dot')
      if (primaryDot) {
        if (nearest.primaryY != null) { primaryDot.setAttribute('cx', String(nearest.x)); primaryDot.setAttribute('cy', String(nearest.primaryY)); (primaryDot as SVGElement).style.display = 'block' }
        else (primaryDot as SVGElement).style.display = 'none'
      }
      if (secondaryDot) {
        if (nearest.secondaryY != null) { secondaryDot.setAttribute('cx', String(nearest.x)); secondaryDot.setAttribute('cy', String(nearest.secondaryY)); (secondaryDot as SVGElement).style.display = 'block' }
        else (secondaryDot as SVGElement).style.display = 'none'
      }

      const sub: string[] = []
      if (nearest.primary != null) sub.push(`${payload.primaryLabel}: ${nearest.primary.toLocaleString()} kcal`)
      if (nearest.secondary != null) sub.push(`${payload.secondaryLabel}: ${nearest.secondary.toLocaleString()} kcal`)
      const html = `<strong>${nearest.label}</strong>` + (sub.length ? `<span class="ct-sub">${sub.join(' · ')}</span>` : '')
      setTip({ html, x: clientX, y: clientY })
    }

    function hideTrendCursor(hitEl: Element) {
      const svg = hitEl.closest('svg')
      if (!svg) return
      const cursorLine = svg.querySelector('.trend-cursor-line') as SVGElement | null
      if (cursorLine) cursorLine.style.display = 'none'
      svg.querySelectorAll('.trend-cursor-dot').forEach((dot) => ((dot as SVGElement).style.display = 'none'))
    }

    document.addEventListener('pointerover', handleOver)
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerout', handleOut)
    return () => {
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerout', handleOut)
    }
  }, [])

  // Keep the tooltip on-screen, nudging it away from viewport edges — mirrors
  // the old imperative positioning logic, just re-run as a layout effect after render.
  useEffect(() => {
    if (!tip || !elRef.current) return
    const el = elRef.current
    const pad = 4
    const rect = el.getBoundingClientRect()
    let dx = 0, dy = 0
    if (rect.right > window.innerWidth - pad) dx = window.innerWidth - pad - rect.right
    if (rect.left < pad) dx = pad - rect.left
    if (rect.top < pad) dy = pad - rect.top
    if (dx || dy) {
      el.style.left = `${tip.x + dx}px`
      el.style.top = `${tip.y - 10 + dy}px`
    }
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={elRef}
      className="chart-tooltip"
      style={{ display: 'block', left: tip.x, top: tip.y - 10 }}
      dangerouslySetInnerHTML={{ __html: tip.html }}
    />
  )
}

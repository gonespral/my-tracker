import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import Icon from './Icon'

const REFRESH_THRESHOLD = 64
const MAX_PULL = 96
const LOCKED_PULL = 44
const MIN_REFRESH_MS = 500
const MOBILE_QUERY = '(max-width: 767px)'

interface DragState { pointerId: number; startY: number; dragging: boolean }

function scrollTopOf(el: HTMLElement | null) {
  const panel = el?.closest('.panel')
  return panel ? panel.scrollTop : 0
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const handler = () => setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

// Touch-only pull-to-refresh: dragging down while already scrolled to the
// top reveals a badge that rotates with the pull and turns accent-colored
// once past the release threshold, then spins while `onRefresh` runs.
// Mobile only — desktop has independently-scrolling columns instead of one
// full-panel scroller, so the gesture doesn't map onto that layout.
export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: ReactNode }) {
  const isMobile = useIsMobile()
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'touch' || refreshing) return
    if (scrollTopOf(wrapRef.current) > 0) return
    drag.current = { pointerId: e.pointerId, startY: e.clientY, dragging: false }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId || refreshing) return
    const delta = e.clientY - d.startY
    if (delta <= 0 || scrollTopOf(wrapRef.current) > 0) {
      drag.current = null
      setPull(0)
      return
    }
    d.dragging = true
    e.preventDefault()
    setPull(Math.min(MAX_PULL, delta * 0.5))
  }

  async function endDrag(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const wasDragging = d.dragging
    const finalPull = pull
    drag.current = null
    if (!wasDragging) { setPull(0); return }

    if (finalPull >= REFRESH_THRESHOLD) {
      setRefreshing(true)
      setPull(LOCKED_PULL)
      const start = Date.now()
      try { await onRefresh() } catch { /* the refresh action surfaces its own errors */ }
      const elapsed = Date.now() - start
      if (elapsed < MIN_REFRESH_MS) await new Promise((r) => setTimeout(r, MIN_REFRESH_MS - elapsed))
      setRefreshing(false)
      setPull(0)
    } else {
      setPull(0)
    }
  }

  if (!isMobile) return <>{children}</>

  const progress = Math.min(1, pull / REFRESH_THRESHOLD)
  const dragging = drag.current !== null

  return (
    <div
      ref={wrapRef}
      className="ptr-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="ptr-indicator"
        style={{ transform: `translate(-50%, calc(-100% + ${pull}px))`, opacity: Math.min(1, pull / 20) }}
      >
        <div className={`ptr-badge${refreshing ? ' refreshing' : ''}${progress >= 1 ? ' ready' : ''}`}>
          <Icon name="refresh" size={20} style={refreshing ? undefined : { transform: `rotate(${progress * 180}deg)` }} />
        </div>
      </div>
      <div
        className="ptr-content"
        style={{ transform: `translateY(${pull}px)`, transition: dragging ? 'none' : 'transform .25s cubic-bezier(.4,0,.2,1)' }}
      >
        {children}
      </div>
    </div>
  )
}

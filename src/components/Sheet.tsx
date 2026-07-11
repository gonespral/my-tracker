import { useRef, type PointerEvent, type ReactNode } from 'react'
import { closeSheet } from '../lib/sheets'

const DISMISS_THRESHOLD = 56

interface DragState { pointerId: number; startY: number; dragging: boolean }

// Bottom drawer. Always mounted (visibility is purely the `.open` class) so
// the CSS slide transition plays on both open and close — unmounting on
// close would skip the close animation entirely. Height is dynamic to
// content (capped + scrollable, see `.sheet` in style.css). The whole header
// (not just the handle pill) supports a drag-down-to-dismiss gesture.
export default function Sheet({ open, title, titleBadge, children }: { open: boolean; title: string; titleBadge?: ReactNode; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const el = sheetRef.current
    if (!el) return
    drag.current = { pointerId: e.pointerId, startY: e.clientY, dragging: false }
    el.style.transition = 'none'
    // Don't capture the pointer yet: capture retargets the eventual `click`
    // to the header, which would swallow taps on interactive title-badge
    // elements (e.g. the force-update version chip). Capture starts in
    // handlePointerMove once an actual drag begins.
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    const el = sheetRef.current
    if (!d || !el || e.pointerId !== d.pointerId) return
    const delta = e.clientY - d.startY
    if (!d.dragging && Math.abs(delta) < 6) return
    if (!d.dragging) e.currentTarget.setPointerCapture(e.pointerId)
    d.dragging = true
    el.style.transform = `translateY(${Math.max(-20, Math.min(220, delta))}px)`
  }

  function endDrag(e: PointerEvent<HTMLDivElement>, dismiss: boolean) {
    const d = drag.current
    const el = sheetRef.current
    if (!d || !el || e.pointerId !== d.pointerId) return
    el.style.transition = ''
    el.style.transform = ''
    if (dismiss && d.dragging) {
      const delta = e.clientY - d.startY
      if (delta > DISMISS_THRESHOLD) closeSheet()
    }
    drag.current = null
  }

  return (
    <div ref={sheetRef} className={`sheet${open ? ' open' : ''}`}>
      <div
        className="sheet-header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
      >
        <div className="sheet-handle" />
        <div className="sheet-title">
          <span>{title}</span>
          {titleBadge}
        </div>
      </div>
      <div className="sheet-scroll">
        {children}
      </div>
    </div>
  )
}

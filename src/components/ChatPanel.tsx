import { useEffect, useRef, type PointerEvent } from 'react'
import { useAppStore, type ChatPanelState } from '../store'
import Icon from './Icon'

const HANDLE_HEIGHT = 18
const PEEK_HEIGHT = 75
const expandedHeight = () => Math.round(window.innerHeight * 0.65)

// Auto-minimize the expanded panel to peek after this long with no new
// message sent or received (paused while a reply is still in flight).
const INACTIVITY_MS = 90_000

interface DragState { pointerId: number; startY: number; startHeight: number; dragging: boolean }

export default function ChatPanel() {
  const panelState = useAppStore((s) => s.chatPanelState)
  const chatDisplay = useAppStore((s) => s.chatDisplay)
  const chatPending = useAppStore((s) => s.chatPending)
  const messagesRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatDisplay])

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-peek-h', panelState === 'collapsed' ? '18px' : '75px')
  }, [panelState])

  useEffect(() => {
    if (panelState !== 'expanded' || chatPending) return
    const t = setTimeout(() => {
      if (useAppStore.getState().chatPanelState === 'expanded') {
        useAppStore.setState({ chatPanelState: 'peek' })
      }
    }, INACTIVITY_MS)
    return () => clearTimeout(t)
  }, [panelState, chatPending, chatDisplay.length])

  const lastAssistant = [...chatDisplay].reverse().find((m) => m.role === 'assistant')

  // Springy drag-to-resize on any of the three handles below, snapping to
  // whichever of collapsed/peek/expanded the released height is closest to —
  // ported from the old chatDragHandles/bindSnapDrag logic in js/app.js.
  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startHeight: panel.getBoundingClientRect().height, dragging: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    panel.classList.add('dragging')
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    const panel = panelRef.current
    if (!d || !panel || e.pointerId !== d.pointerId) return
    const delta = e.clientY - d.startY
    if (!d.dragging && Math.abs(delta) < 4) return
    d.dragging = true
    const maxHeight = chatDisplay.length > 0 ? expandedHeight() : HANDLE_HEIGHT
    const nextHeight = Math.max(HANDLE_HEIGHT, Math.min(maxHeight, d.startHeight - delta))
    panel.style.height = `${nextHeight}px`
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    const panel = panelRef.current
    if (!d || !panel || e.pointerId !== d.pointerId) return
    panel.classList.remove('dragging')
    const currentHeight = panel.getBoundingClientRect().height
    panel.style.height = ''
    if (d.dragging) {
      const states: [ChatPanelState, number][] = [
        ['collapsed', HANDLE_HEIGHT],
        ['peek', PEEK_HEIGHT],
        ['expanded', expandedHeight()],
      ]
      let best = states[0]
      let bestDelta = Math.abs(currentHeight - best[1])
      for (const s of states.slice(1)) {
        const dd = Math.abs(currentHeight - s[1])
        if (dd < bestDelta) { best = s; bestDelta = dd }
      }
      useAppStore.setState({ chatPanelState: best[0] })
      suppressClickRef.current = true
      setTimeout(() => { suppressClickRef.current = false }, 0)
    }
    drag.current = null
  }

  function toggle() {
    if (suppressClickRef.current) return
    if (panelState === 'expanded') useAppStore.setState({ chatPanelState: 'peek' })
    else if (panelState === 'peek') { if (chatDisplay.length > 0) useAppStore.setState({ chatPanelState: 'expanded' }) }
    else if (chatDisplay.length > 0) useAppStore.setState({ chatPanelState: 'peek' })
  }

  function expandIfHasMessages() {
    if (suppressClickRef.current) return
    if (chatDisplay.length > 0) useAppStore.setState({ chatPanelState: 'expanded' })
  }

  const dragHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }

  return (
    <div ref={panelRef} id="chat-panel" className={panelState}>
      <div className="chat-panel-handle-row" id="chat-panel-handle" onClick={toggle} {...dragHandlers}>
        <div className="chat-panel-handle" />
      </div>
      <div id="chat-peek-body" onClick={expandIfHasMessages} {...dragHandlers}>
        <div className="chat-peek-label">Sonnet 4.6</div>
        <div className={`chat-peek-text${lastAssistant?.role === 'assistant' && lastAssistant.thinking ? ' thinking' : ''}`}>
          {lastAssistant?.role === 'assistant' ? lastAssistant.text : ''}
        </div>
      </div>
      <div id="chat-panel-body">
        <div className="chat-header" {...dragHandlers}>
          <div className="sheet-title" style={{ margin: 0 }}><span>Sonnet 4.6</span></div>
        </div>
        <div className="chat-messages" id="chat-messages" ref={messagesRef}>
          {chatDisplay.map((m, i) => {
            if (m.role === 'tool') {
              return (
                <div className="chat-tool-row" key={i}>
                  {m.items.map((it, j) => (
                    <span className={`chat-tool-item${it.ok ? '' : ' fail'}`} key={j}>
                      <Icon name={it.ok ? 'travel_explore' : 'error'} className="chat-tool-icon" />
                      {it.label}
                    </span>
                  ))}
                </div>
              )
            }
            const bubble = (
              <div className={`chat-bubble ${m.role}${m.role === 'assistant' && m.thinking ? ' thinking' : ''}`} key={i}>
                {m.text}
                {m.role === 'user' && !!m.imageCount && (
                  <span className="chat-img-label">{m.imageCount} image{m.imageCount > 1 ? 's' : ''} attached</span>
                )}
              </div>
            )
            if (m.role === 'assistant') {
              return (
                <div className="chat-assistant-row" key={i}>
                  <Icon name="robot_2" size={16} className="chat-claude-icon" />
                  {bubble}
                </div>
              )
            }
            return bubble
          })}
        </div>
      </div>
    </div>
  )
}

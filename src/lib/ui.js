import { state } from './state.js'
import { openSheetId, toastMsg, toastTimer, pendingEdit, pendingClaudeDraft } from '../stores.js'
import { get } from 'svelte/store'

export function syncBackdrop() {
  // No-op: Svelte components react to openSheetId store directly.
}

export function bindSnapDrag(handleEl, {
  targetEl,
  states,
  getState,
  setState,
  threshold = 56,
} = {}) {
  if (!handleEl || handleEl.dataset.snapDragBound === 'true') return
  handleEl.dataset.snapDragBound = 'true'

  const target = targetEl || handleEl.closest('.sheet')
  const stateList = Array.isArray(states) ? states : []
  if (!stateList.length || typeof getState !== 'function' || typeof setState !== 'function') return

  let pointerId = null
  let startY = 0
  let startState = null
  let dragging = false
  let suppressClick = false

  const resetTarget = () => {
    if (!target) return
    target.style.transform = ''
    target.style.transition = ''
    target.style.willChange = ''
  }

  const applyDrag = delta => {
    if (!target) return
    const clamped = Math.max(-80, Math.min(180, delta))
    target.style.transform = `translateY(${clamped}px)`
    target.style.willChange = 'transform'
  }

  const finishDrag = delta => {
    const wasDragging = dragging
    resetTarget()
    if (!wasDragging) return

    const currentIndex = stateList.indexOf(startState)
    if (currentIndex === -1) return

    const step = Math.max(1, Math.floor(Math.abs(delta) / threshold))
    const direction = delta > 0 ? 1 : -1
    const nextIndex = Math.max(0, Math.min(stateList.length - 1, currentIndex + (direction * step)))
    if (nextIndex !== currentIndex) setState(stateList[nextIndex])
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 0)
  }

  handleEl.style.touchAction = 'none'
  handleEl.style.userSelect = 'none'
  handleEl.style.cursor = 'grab'

  handleEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    pointerId = e.pointerId
    startY = e.clientY
    startState = getState()
    dragging = false
    handleEl.setPointerCapture(pointerId)
    if (target) target.style.transition = 'none'
  })

  handleEl.addEventListener('pointermove', e => {
    if (e.pointerId !== pointerId) return
    const delta = e.clientY - startY
    if (!dragging && Math.abs(delta) < 6) return
    dragging = true
    e.preventDefault()
    applyDrag(delta)
  })

  handleEl.addEventListener('pointerup', e => {
    if (e.pointerId !== pointerId) return
    finishDrag(e.clientY - startY)
    pointerId = null
    startState = null
    dragging = false
  })

  handleEl.addEventListener('pointercancel', e => {
    if (e.pointerId !== pointerId) return
    resetTarget()
    pointerId = null
    startState = null
    dragging = false
  })

  handleEl.addEventListener('click', e => {
    if (!suppressClick) return
    e.preventDefault()
    e.stopImmediatePropagation()
  }, true)
}

export function showToast(msg) {
  const prev = get(toastTimer)
  if (prev) clearTimeout(prev)
  toastMsg.set(msg)
  const t = setTimeout(() => toastMsg.set(null), 4500)
  toastTimer.set(t)
}

export function openSheet(id) {
  openSheetId.set(id)
}

export function closeSheet(id) {
  if (get(openSheetId) === id) openSheetId.set(null)
}

export function closeSheets() {
  openSheetId.set(null)
  pendingEdit.set({ type: null, id: null })
  pendingClaudeDraft.set(null)
}

export function toggleEntryMenu(btn) {
  const menu = btn.nextElementSibling
  if (!menu) return
  const isOpen = menu.classList.contains('open')
  closeMenus()
  if (!isOpen) {
    menu.classList.add('open')
    const menuHosts = [
      btn.closest('.anim-item'),
      btn.closest('.log-item'),
      btn.closest('.conflict-stack'),
      btn.closest('.conflict-stack-below .log-item'),
    ].filter(Boolean)
    for (const host of menuHosts) {
      host.style.position = 'relative'
      host.style.zIndex = '10000'
    }
  }
}

export const closeMenus = () => {
  document.querySelectorAll('.entry-menu.open').forEach(m => m.classList.remove('open'))
  document.querySelectorAll('.anim-item, .log-item, .conflict-stack').forEach(el => {
    el.style.position = ''
    el.style.zIndex = ''
  })
}

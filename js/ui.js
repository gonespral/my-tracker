import { state } from './state.js'

export function syncBackdrop() {
  const backdrop = document.getElementById('backdrop')
  if (!backdrop) return
  const hasOpenSheet = !!document.querySelector('.sheet.open')
  const chatPanel = document.getElementById('chat-panel')
  const chatExpanded = !!chatPanel?.classList.contains('expanded')
  backdrop.classList.toggle('visible', hasOpenSheet || chatExpanded)
  backdrop.classList.toggle('chat-active', chatExpanded)
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

  const target = targetEl || handleEl.closest('#chat-panel, .sheet')
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
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(state.toastTmr)
  state.toastTmr = setTimeout(() => t.classList.remove('show'), 4500)
}

export function openSheet(id) {
  syncBackdrop()
  document.getElementById(id).classList.add('open')
  syncBackdrop()
}

export function closeSheets() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'))
  state.pendingEditFoodId    = null
  state.pendingEditWorkoutId = null
  state.pendingEditWeightDate = null
  const logBtn = document.getElementById('log-food-btn')
  if (logBtn) logBtn.textContent = 'Log Food'
  const wkBtn = document.getElementById('save-workout-btn')
  if (wkBtn) wkBtn.textContent = 'Log Workout'
  // Re-enable date inputs in case they were disabled for edit mode
  const fDate = document.getElementById('f-date')
  if (fDate) fDate.disabled = false
  const wDate = document.getElementById('w-date')
  if (wDate) wDate.disabled = false
  syncBackdrop()
}

export function toggleEntryMenu(btn) {
  const menu = btn.nextElementSibling
  const isOpen = menu.classList.contains('open')
  closeMenus()
  if (!isOpen) menu.classList.add('open')
}

export const closeMenus = () =>
  document.querySelectorAll('.entry-menu.open').forEach(m => m.classList.remove('open'))

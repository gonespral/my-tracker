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

// ── Chart hover tooltips ─────────────────────────────────────
// Any SVG/HTML element with a `data-tip` attribute (innerHTML string) gets
// a floating tooltip on hover. Bound once at startup via event delegation
// since chart markup is re-rendered constantly through innerHTML.
let tooltipEl = null
let tooltipBound = false

export function initChartTooltips() {
  if (tooltipBound) return
  tooltipBound = true

  document.addEventListener('pointerover', e => {
    const target = e.target.closest('[data-tip]')
    if (!target) return
    showChartTooltip(target.dataset.tip, e.clientX, e.clientY)
  })
  document.addEventListener('pointermove', e => {
    const trendHit = e.target.closest('.trend-hit')
    if (trendHit) { handleTrendHover(trendHit, e); return }
    if (!tooltipEl || tooltipEl.style.display === 'none') return
    if (!e.target.closest('[data-tip]')) return
    positionChartTooltip(e.clientX, e.clientY)
  })
  document.addEventListener('pointerout', e => {
    const target = e.target.closest('[data-tip], .trend-hit')
    if (!target) return
    if (e.relatedTarget && target.contains(e.relatedTarget)) return
    hideChartTooltip()
    if (target.classList.contains('trend-hit')) hideTrendCursor(target)
  })
}

// Continuous crosshair hover for trend-line charts: finds the nearest day to
// the pointer's x position (in SVG user units) and moves the cursor line +
// dots to it, since — unlike bars — points along a line aren't discrete
// hoverable elements.
function handleTrendHover(hitEl, e) {
  let payload
  try { payload = JSON.parse(hitEl.dataset.trend) } catch { return }
  const svg = hitEl.closest('svg')
  if (!svg || !payload.days?.length) return

  const rect = svg.getBoundingClientRect()
  const vb = svg.viewBox.baseVal
  const svgX = (e.clientX - rect.left) / rect.width * vb.width

  let nearest = payload.days[0], minDist = Infinity
  for (const d of payload.days) {
    const dist = Math.abs(d.x - svgX)
    if (dist < minDist) { minDist = dist; nearest = d }
  }

  const cursorLine = svg.querySelector('.trend-cursor-line')
  if (cursorLine) {
    cursorLine.setAttribute('x1', nearest.x)
    cursorLine.setAttribute('x2', nearest.x)
    cursorLine.style.display = 'block'
  }
  const [primaryDot, secondaryDot] = svg.querySelectorAll('.trend-cursor-dot')
  if (primaryDot) {
    if (nearest.primaryY != null) { primaryDot.setAttribute('cx', nearest.x); primaryDot.setAttribute('cy', nearest.primaryY); primaryDot.style.display = 'block' }
    else primaryDot.style.display = 'none'
  }
  if (secondaryDot) {
    if (nearest.secondaryY != null) { secondaryDot.setAttribute('cx', nearest.x); secondaryDot.setAttribute('cy', nearest.secondaryY); secondaryDot.style.display = 'block' }
    else secondaryDot.style.display = 'none'
  }

  const sub = []
  if (nearest.primary   != null) sub.push(`${payload.primaryLabel}: ${nearest.primary.toLocaleString()} kcal`)
  if (nearest.secondary != null) sub.push(`${payload.secondaryLabel}: ${nearest.secondary.toLocaleString()} kcal`)
  const html = `<strong>${nearest.label}</strong>` + (sub.length ? `<span class="ct-sub">${sub.join(' · ')}</span>` : '')
  showChartTooltip(html, e.clientX, e.clientY)
}

function hideTrendCursor(hitEl) {
  const svg = hitEl.closest('svg')
  if (!svg) return
  const cursorLine = svg.querySelector('.trend-cursor-line')
  if (cursorLine) cursorLine.style.display = 'none'
  svg.querySelectorAll('.trend-cursor-dot').forEach(dot => dot.style.display = 'none')
}

function showChartTooltip(html, x, y) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'chart-tooltip'
    document.body.appendChild(tooltipEl)
  }
  tooltipEl.innerHTML = html
  tooltipEl.style.display = 'block'
  positionChartTooltip(x, y)
}

function positionChartTooltip(x, y) {
  if (!tooltipEl) return
  const pad = 10
  tooltipEl.style.left = `${x}px`
  tooltipEl.style.top = `${y - pad}px`
  const rect = tooltipEl.getBoundingClientRect()
  let dx = 0, dy = 0
  if (rect.right > window.innerWidth - 4) dx = window.innerWidth - 4 - rect.right
  if (rect.left < 4) dx = 4 - rect.left
  if (rect.top < 4) dy = 4 - rect.top
  if (dx || dy) {
    tooltipEl.style.left = `${x + dx}px`
    tooltipEl.style.top = `${y - pad + dy}px`
  }
}

function hideChartTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none'
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

export function closeSheet(id) {
  document.getElementById(id)?.classList.remove('open')
  syncBackdrop()
}

export function closeSheets() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'))
  state.pendingEditFoodId    = null
  state.pendingEditWorkoutId = null
  state.pendingEditWeightDate = null
  state.pendingClaudeDraft = null
  const logBtn = document.getElementById('log-food-btn')
  if (logBtn) logBtn.textContent = 'Log Food'
  const wkBtn = document.getElementById('save-workout-btn')
  if (wkBtn) wkBtn.textContent = 'Log Activity'
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

import { state } from './state.js'
import { dataGen } from '../stores.js'
import { supabase, db, setWorkoutConflictOverride, dismissWorkoutConflict, reflagWorkoutConflict, isDemo } from './db.js'
import { TARGETS, hydrateCalorieTargets, setCalorieDeficit, getCalorieGoal } from './config.js'
import { dateStr } from './utils.js'
import { showToast, openSheet, closeSheet, closeSheets, toggleEntryMenu, closeMenus } from './ui.js'
import { startListening, stopListening } from './speech.js'
import { openChat, expandChatPanel, collapseChatPanel, hideChatPanel, toggleChatPanel, sendChatMessage, setChatPanelState, isChatLoading, abortChat } from './ai.js'
import { openFoodSheet, openFoodSheetWithPreset, openWorkoutSheet, editFood, editWorkout, saveToMeals, reloadWisdom } from './tabs/today.js'
import { renderSettings, openPresetSheet, deletePreset, openWorkoutPresetSheet, deleteWorkoutPreset } from './tabs/settings.js'
import { handleStravaCallback, syncStrava, stravaIsConnected, pushActivityToStrava, deleteActivityFromStrava, stravaAutoPushEnabled } from './strava.js'
import { handleGoogleHealthCallback, syncGoogleHealth, googleHealthIsConnected, pushActivityToGoogleHealth, deleteActivityFromGoogleHealth, ghAutoPushEnabled } from './google-health.js'
import { markPushedToStrava, markPushedToGH, clearPushedToStrava, clearPushedToGH } from './push-tracker.js'
import { showTutorialIfNew } from './tutorial.js'
import { clearFailed } from './sync-status.js'

function signIn() {
  supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

function signInGoogle() {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

// ── Tab routing ────────────────────────────────────────────────

// Signal tab components to re-render (they react to dataGen store)
export function renderActive() {
  dataGen.update(n => n + 1)
}

export function switchTab(tab) {
  state.activeTab = tab
  localStorage.setItem('tracker-tab', tab)
}

// ── Event delegation for dynamically-generated content ─────────
document.addEventListener('click', async (e) => {
  const actionEl = e.target.closest('[data-action]')
  if (!actionEl) return

  const action = actionEl.dataset.action
  const id = actionEl.dataset.id
  const date = actionEl.dataset.date
  const meal = actionEl.dataset.meal

  switch (action) {
    case 'signin': signIn(); break
    case 'signin-google': signInGoogle(); break
    case 'demo-mode': localStorage.setItem('tracker-demo', '1'); window.location.reload(); break

    case 'toggle-menu':
      toggleEntryMenu(actionEl)
      break

    case 'expand-conflict-stack': {
      if (e.target.closest('.entry-menu-wrap')) break
      const stack = e.target.closest('.conflict-stack')
      if (!stack) break
      const below = stack.querySelector('.conflict-stack-below')
      const group = stack.dataset.group

      if (stack.classList.contains('conflict-stack--expanded')) {
        const frontCard = stack.querySelector('.log-item:first-child')
        if (!frontCard?.contains(e.target)) break
        if (below) below.style.overflow = ''
        stack.classList.remove('conflict-stack--expanded')
        state.expandedConflictGroups.delete(group)
      } else {
        stack.classList.add('conflict-stack--expanded')
        if (below) below.style.overflow = 'visible'
        state.expandedConflictGroups.add(group)
      }
      break
    }

    case 'edit-food':
      editFood(id, date)
      break

    case 'save-to-meals':
      await saveToMeals(id, date)
      break

    case 'delete-food':
      closeMenus()
      if (!confirm('Delete this food entry?')) break
      try { await db.deleteFood(id); await renderActive() }
      catch (err) { showToast('❌ ' + err.message) }
      break

    case 'open-food-sheet':
      openFoodSheet(meal || 'snack', date || null)
      break

    case 'edit-workout':
      editWorkout(id, date)
      break

    case 'delete-workout':
      closeMenus()
      if (!confirm('Delete this activity?')) break
      try { await db.deleteWorkout(id); await renderActive() }
      catch (err) { showToast('❌ ' + err.message) }
      break

    case 'push-to-strava': {
      closeMenus()
      const entry = Object.values(state.dbCache?.workouts || {}).flat().find(e => e.id === id)
      if (!entry) { showToast('❌ Activity not found'); break }
      if (!entry.duration_min) { showToast('❌ Set a duration before pushing to Strava'); break }
      showToast('🔄 Pushing to Strava…')
      try {
        const { id: remoteId } = await pushActivityToStrava(entry)
        markPushedToStrava(entry.id, remoteId)
        showToast('✅ Pushed to Strava')
        syncStrava({ onComplete: renderActive }).catch(e => console.warn('Strava sync:', e))
      }
      catch (err) { showToast('❌ ' + err.message) }
      break
    }

    case 'push-to-google-health': {
      closeMenus()
      const entry = Object.values(state.dbCache?.workouts || {}).flat().find(e => e.id === id)
      if (!entry) { showToast('❌ Activity not found'); break }
      if (!entry.duration_min) { showToast('❌ Set a duration before pushing to Google Health'); break }
      showToast('🔄 Pushing to Google Health…')
      try {
        const remoteId = await pushActivityToGoogleHealth(entry)
        markPushedToGH(entry.id, remoteId)
        showToast('✅ Pushed to Google Health')
        syncGoogleHealth({ onComplete: renderActive }).catch(e => console.warn('GH sync:', e))
      }
      catch (err) { showToast('❌ ' + err.message) }
      break
    }

    case 'delete-from-strava': {
      closeMenus()
      if (!confirm('Delete this activity from Strava and remove it locally?')) break
      const remoteId = actionEl.dataset.remoteId
      if (!remoteId) { showToast('❌ No Strava activity ID'); break }
      showToast('🔄 Deleting from Strava…')
      try {
        await deleteActivityFromStrava(remoteId)
        await db.deleteWorkout(id)
        await renderActive()
        showToast('✅ Deleted from Strava')
      }
      catch (err) { showToast('❌ ' + err.message) }
      break
    }

    case 'delete-from-gh': {
      closeMenus()
      if (!confirm('Delete this activity from Google Health and remove it locally?')) break
      const remoteId = actionEl.dataset.remoteId
      if (!remoteId) { showToast('❌ No Google Health data point ID'); break }
      showToast('🔄 Deleting from Google Health…')
      try {
        await deleteActivityFromGoogleHealth(remoteId)
        await db.deleteWorkout(id)
        await renderActive()
        showToast('✅ Deleted from Google Health')
      }
      catch (err) { showToast('❌ ' + err.message) }
      break
    }

    case 'unlink-from-gh': {
      closeMenus()
      if (!confirm('Remove this activity from Google Health? It will be kept locally.')) break
      const remoteId = actionEl.dataset.remoteId
      if (!remoteId) { showToast('❌ No Google Health data point ID'); break }
      showToast('🔄 Removing from Google Health…')
      try {
        await deleteActivityFromGoogleHealth(remoteId)
        clearPushedToGH(id)
        await renderActive()
        showToast('✅ Removed from Google Health (kept locally)')
      }
      catch (err) { showToast('❌ ' + err.message) }
      break
    }

    case 'unlink-from-strava': {
      closeMenus()
      if (!confirm('Remove this activity from Strava? It will be kept locally.')) break
      const remoteId = actionEl.dataset.remoteId
      if (!remoteId) { showToast('❌ No Strava activity ID'); break }
      showToast('🔄 Removing from Strava…')
      try {
        await deleteActivityFromStrava(remoteId)
        clearPushedToStrava(id)
        await renderActive()
        showToast('✅ Removed from Strava (kept locally)')
      }
      catch (err) { showToast('❌ ' + err.message) }
      break
    }

    case 'activate-workout-conflict':
      closeMenus()
      try {
        setWorkoutConflictOverride(actionEl.dataset.group, actionEl.dataset.source, actionEl.dataset.id)
        db.bust()
        await renderActive()
        showToast('✅ Selected activity will count')
      } catch (err) { showToast('❌ ' + err.message) }
      break

    case 'unflag-workout-conflict':
      closeMenus()
      dismissWorkoutConflict(actionEl.dataset.group)
      db.bust()
      await renderActive()
      showToast('✅ Marked as not a duplicate')
      break

    case 'reflag-workout-conflict':
      closeMenus()
      reflagWorkoutConflict(actionEl.dataset.group)
      db.bust()
      await renderActive()
      showToast('✅ Flagged as duplicate again')
      break

    case 'open-workout-sheet':
      openWorkoutSheet(date || null)
      break

    case 'goto-activity-date': {
      const target = document.querySelector(`.workout-day-group[data-date="${date}"]`)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }

    case 'log-weight':
      state.pendingEditWeightDate = null
      openSheet('weight-edit-sheet')
      break

    case 'edit-weight': {
      closeMenus()
      const data = state.dbCache || await db.load()
      const entry = (data.weights || []).find(w => w.date === date)
      if (!entry) break
      state.pendingEditWeightDate = date
      openSheet('weight-edit-sheet')
      break
    }

    case 'delete-weight':
      closeMenus()
      if (!confirm('Delete this weight entry?')) break
      try { await db.deleteWeight(date); await renderActive() }
      catch (err) { showToast('❌ ' + err.message) }
      break

    case 'edit-preset':
      openPresetSheet(id)
      break

    case 'delete-preset':
      await deletePreset(id)
      break

    case 'add-meal-preset':
      openPresetSheet(null)
      break

    case 'edit-workout-preset':
      openWorkoutPresetSheet(id)
      break

    case 'delete-workout-preset':
      await deleteWorkoutPreset(id)
      break

    case 'add-workout-preset':
      openWorkoutPresetSheet(null)
      break

    case 'panel-stats-toggle': {
      const section = actionEl.nextElementSibling
      if (!section) break
      const isOpen = section.style.display !== 'none'
      section.style.display = isOpen ? 'none' : 'block'
      const arrow = actionEl.querySelector('.panel-toggle-arrow')
      if (arrow) arrow.textContent = isOpen ? 'expand_more' : 'expand_less'
      break
    }

    case 'toggle-section': {
      const accordion = actionEl.closest('.accordion')
      if (accordion) accordion.classList.toggle('open')
      break
    }
    case 'reload-wisdom':
      reloadWisdom()
      break

    case 'heatmap-month': {
      const offset = parseInt(actionEl.dataset.offset, 10)
      if (!isNaN(offset)) {
        state.heatmapMonthOffset = offset
        renderActive()
      }
      break
    }
  }
})

document.addEventListener('workout-conflict-pref-changed', async () => {
  db.bust()
  await renderActive()
})

document.addEventListener('click', e => {
  if (!e.target.closest('.entry-menu-wrap'))
    document.querySelectorAll('.entry-menu.open').forEach(m => m.classList.remove('open'))
})

// ── Meal fuzzy matching ───────────────────────────────────────

const QUERY_RE = /\b(edit|delete|remove|update|change|modify|how|what|why|when|where|which|who|can|could|would|should|help|show|tell|find|is|are|was|were|did|does|do)\b/i

function mealSimilarity(input, mealName) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const a = norm(input)
  const b = norm(mealName)
  if (!a || !b) return 0
  if (a === b) return 1

  const ta = a.split(' ')
  const tbSet = new Set(b.split(' '))

  const extraWords = ta.filter(t => !tbSet.has(t))
  if (extraWords.length > 1) return 0

  const allTokens = new Set([...ta, ...tbSet])
  const hits = ta.filter(t => tbSet.has(t)).length
  const jaccard = hits / allTokens.size
  const containsBonus = (b.includes(a) || a.includes(b)) ? 0.15 : 0
  return Math.min(1, jaccard + containsBonus)
}

function findMatchingMeal(text) {
  if (QUERY_RE.test(text) || text.includes('?')) return null

  const meals = state.mealsCache || []
  let best = null, bestScore = 0
  for (const m of meals) {
    const score = mealSimilarity(text, m.name)
    if (score > bestScore) { bestScore = score; best = m }
  }
  return bestScore >= 0.65 ? best : null
}

// ── Main app init (runs after Svelte mounts) ───────────────────
async function initApp() {
  await handleStravaCallback()
  await handleGoogleHealthCallback()

  const demoBtn = document.getElementById('demo-btn')
  if (isDemo && demoBtn) {
    demoBtn.style.display = 'inline-flex'
    demoBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
    })
  }

  try {
    const [s, data] = await Promise.all([db.loadSettings(), db.load()])
    if (s) {
      TARGETS.calories.rest = s.cal_rest
      TARGETS.protein = s.protein_g
      TARGETS.carbs = s.carbs_g
      TARGETS.fat = s.fat_g
      const deficitKey = `tracker-bmr-deficit:${state.currentUser.id}`
      const rawDeficit = Number(localStorage.getItem(deficitKey) || 0)
      const deficit = Number.isFinite(rawDeficit) && rawDeficit >= 0 ? Math.round(rawDeficit) : 0
      const profile = {
        age: s.age_years ?? '',
        sex: s.sex ?? 'other',
        height_cm: s.height_cm ?? '',
        weight_kg: s.weight_kg ?? '',
        activity_level: s.activity_level ?? 'moderate',
      }
      hydrateCalorieTargets(profile, data?.weights?.[0]?.kg ?? null)
      setCalorieDeficit(deficit)
      TARGETS.calories.training = TARGETS.calories.goal
    }
  } catch (e) { console.warn('Settings load failed:', e.message) }

  if (window.innerWidth >= 768) {
    state.statsOpen = true
  }

  showTutorialIfNew()

  // ── Main chat input ──
  const mainInput = document.getElementById('main-input')
  const resizeInput = () => {
    mainInput.style.height = 'auto'
    mainInput.style.height = Math.min(mainInput.scrollHeight, window.innerHeight * 0.45) + 'px'
  }
  mainInput.addEventListener('input', resizeInput)

  // ── Image attachment ──
  let pendingImages = []
  const attachBtn = document.getElementById('attach-btn')
  const attachBadge = document.getElementById('attach-badge')
  const imageFileInput = document.getElementById('image-file-input')

  function updateAttachBadge() {
    if (pendingImages.length > 0) {
      attachBadge.textContent = pendingImages.length
      attachBadge.style.display = 'block'
      attachBtn.classList.add('has-images')
    } else {
      attachBadge.style.display = 'none'
      attachBtn.classList.remove('has-images')
    }
  }

  attachBtn.addEventListener('click', () => imageFileInput.click())

  function compressImage(file) {
    const MAX_BYTES = 4.5 * 1024 * 1024
    const MAX_DIM = 1568
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const tryQuality = (quality) => {
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          const base64 = dataUrl.split(',')[1]
          if (base64.length * 0.75 <= MAX_BYTES || quality <= 0.1) {
            resolve({ data: base64, mediaType: 'image/jpeg' })
          } else {
            tryQuality(Math.max(quality - 0.15, 0.1))
          }
        }
        tryQuality(0.85)
      }
      img.onerror = reject
      img.src = url
    })
  }

  imageFileInput.addEventListener('change', async () => {
    const files = Array.from(imageFileInput.files || [])
    imageFileInput.value = ''
    if (!files.length) return
    const loaded = await Promise.all(files.map(compressImage))
    pendingImages = [...pendingImages, ...loaded]
    updateAttachBadge()
  })

  const handleMainInput = async () => {
    const text = mainInput.value.trim()
    if (!text && !pendingImages.length) return

    const images = pendingImages
    pendingImages = []
    updateAttachBadge()

    const chatPanel = document.getElementById('chat-panel')

    if (chatPanel.classList.contains('expanded')) {
      mainInput.value = ''
      resizeInput()
      setSendLoading(true)
      try { await sendChatMessage(text, renderActive, images) } finally { setSendLoading(false) }
      return
    }

    if (images.length) {
      mainInput.value = ''
      resizeInput()
      setSendLoading(true)
      try { await openChat(text, renderActive, images) } finally { setSendLoading(false) }
      return
    }

    if (!state.mealsCache) {
      try { state.mealsCache = await db.loadMeals() } catch (_) { }
    }
    const match = findMatchingMeal(text)
    if (match) {
      mainInput.value = ''
      resizeInput()
      openFoodSheetWithPreset(match)
      return
    }

    mainInput.value = ''
    resizeInput()
    setSendLoading(true)
    try { await openChat(text, renderActive) } finally { setSendLoading(false) }
  }

  const sendBtn = document.getElementById('send-btn')
  const sendBtnIcon = sendBtn.querySelector('.material-symbols-outlined')

  function setSendLoading(loading) {
    if (loading) {
      sendBtnIcon.textContent = 'stop'
      mainInput.disabled = true
    } else {
      sendBtnIcon.textContent = 'send'
      mainInput.disabled = false
    }
  }

  sendBtn.addEventListener('click', () => {
    if (isChatLoading()) { abortChat(); setSendLoading(false); return }
    handleMainInput()
  })
  mainInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMainInput() }
  })
  mainInput.addEventListener('submit-input', handleMainInput)

  document.getElementById('chat-panel-handle').addEventListener('click', toggleChatPanel)
  document.getElementById('chat-peek-body').addEventListener('click', () => {
    if (state.chatDisplay.length > 0) expandChatPanel()
  })

  const chatPanel = document.getElementById('chat-panel')
  const chatHandleHeight = 18
  const chatPeekHeight = 75
  const chatExpandedHeight = () => Math.round(window.innerHeight * 0.65)
  const chatState = () => {
    if (chatPanel.classList.contains('expanded')) return 'expanded'
    if (chatPanel.classList.contains('peek')) return 'peek'
    return 'collapsed'
  }

  const chatDragHandles = [
    document.getElementById('chat-panel-handle'),
    document.getElementById('chat-peek-body'),
    document.querySelector('#chat-panel-body .chat-header'),
  ].filter(Boolean)

  chatDragHandles.forEach(handleEl => {
    if (handleEl.dataset.chatDragBound === 'true') return
    handleEl.dataset.chatDragBound = 'true'

    let pointerId = null
    let startY = 0
    let startHeight = 0
    let dragging = false
    let suppressClick = false

    const clearDrag = () => {
      chatPanel.classList.remove('dragging')
      chatPanel.style.height = ''
      chatPanel.style.transition = ''
    }

    const snapChat = height => {
      const expanded = chatExpandedHeight()
      const states = [
        { name: 'collapsed', height: chatHandleHeight },
        { name: 'peek', height: chatPeekHeight },
        { name: 'expanded', height: expanded },
      ]
      let best = states[0]
      let bestDelta = Math.abs(height - best.height)
      for (const s of states.slice(1)) {
        const delta = Math.abs(height - s.height)
        if (delta < bestDelta) { best = s; bestDelta = delta }
      }
      setChatPanelState(best.name)
    }

    handleEl.style.touchAction = 'none'
    handleEl.style.userSelect = 'none'
    handleEl.style.cursor = 'grab'

    handleEl.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      pointerId = e.pointerId
      startY = e.clientY
      startHeight = chatPanel.getBoundingClientRect().height
      dragging = false
      handleEl.setPointerCapture(pointerId)
      chatPanel.classList.add('dragging')
      chatPanel.style.transition = 'none'
    })

    handleEl.addEventListener('pointermove', e => {
      if (e.pointerId !== pointerId) return
      const delta = e.clientY - startY
      if (!dragging && Math.abs(delta) < 4) return
      dragging = true
      e.preventDefault()
      const minHeight = chatHandleHeight
      const maxHeight = state.chatDisplay.length > 0 ? chatExpandedHeight() : chatHandleHeight
      const nextHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - delta))
      chatPanel.style.height = nextHeight + 'px'
    })

    handleEl.addEventListener('pointerup', e => {
      if (e.pointerId !== pointerId) return
      const currentHeight = chatPanel.getBoundingClientRect().height
      clearDrag()
      if (dragging) {
        snapChat(currentHeight)
        suppressClick = true
        setTimeout(() => { suppressClick = false }, 0)
      }
      pointerId = null
      dragging = false
    })

    handleEl.addEventListener('pointercancel', e => {
      if (e.pointerId !== pointerId) return
      clearDrag()
      pointerId = null
      dragging = false
    })

    handleEl.addEventListener('click', e => {
      if (!suppressClick) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }, true)
  })

  const inputBarEl = document.querySelector('.input-bar')
  const syncBarHeight = () =>
    document.documentElement.style.setProperty('--bar-h', inputBarEl.offsetHeight + 'px')
  new ResizeObserver(syncBarHeight).observe(inputBarEl)
  syncBarHeight()

  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
    } else {
      renderActive()
      if (Date.now() - hiddenAt > 30_000) {
        if (stravaIsConnected()) syncStrava({ onComplete: renderActive }).catch(e => console.warn('Strava sync:', e))
        if (googleHealthIsConnected()) syncGoogleHealth({ onComplete: renderActive }).catch(e => console.warn('GH sync:', e))
      }
    }
  })

  // ── Mic ──
  document.getElementById('mic-btn').addEventListener('click', () => {
    if (state.listening) stopListening(); else startListening()
  })

  // ── Theme toggle ──
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    clearFailed()
    db.bust()
    const [, stravaNew, ghNew] = await Promise.all([
      db.load().then(() => renderActive()).catch(e => console.warn('DB load:', e)),
      stravaIsConnected() ? syncStrava({ onComplete: renderActive }).catch(e => { console.warn('Strava sync:', e); return 0 }) : 0,
      googleHealthIsConnected() ? syncGoogleHealth({ onComplete: renderActive }).catch(e => { console.warn('GH sync:', e); return 0 }) : 0,
    ])
    const parts = []
    if (stravaNew) parts.push(`Strava: ${stravaNew} new`)
    if (ghNew) parts.push(`Google Health: ${ghNew} new`)
    if (parts.length) showToast(`✅ ${parts.join(' · ')}`)
  })

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('tracker-theme', next)
  })

  document.getElementById('apikey-btn').addEventListener('click', async () => {
    try {
      await renderSettings()
      openSheet('settings-sheet')
    } catch (e) {
      console.error('Settings error:', e)
      showToast('❌ ' + e.message)
    }
  })

  if (state.currentUser) {
    db.loadMeals().then(m => { state.mealsCache = m }).catch(() => { })
    db.loadWorkoutPresets().then(w => { state.workoutPresetsCache = w }).catch(() => { })
  }

  await renderActive()

  if (stravaIsConnected()) {
    setInterval(() => syncStrava({ onComplete: renderActive }).catch(e => console.warn('Strava sync:', e)), 60000)
    syncStrava({ onComplete: renderActive }).catch(e => console.warn('Strava sync:', e))
  }
  if (googleHealthIsConnected()) {
    setInterval(() => syncGoogleHealth({ onComplete: renderActive }).catch(e => console.warn('Google Health sync:', e)), 60000)
    syncGoogleHealth({ onComplete: renderActive }).catch(e => console.warn('Google Health sync:', e))
  }
}

// ── Auth bootstrap (called from App.svelte onMount) ────────────
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  state.currentUser = session?.user ?? null

  await initApp()

  supabase.auth.onAuthStateChange((event, session) => {
    state.currentUser = session?.user ?? null
    state.dbCache = null
    renderActive()
  })
}

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled rejection:', e.reason)
  showToast('❌ ' + (e.reason?.message || 'Unknown error'))
})
window.addEventListener('error', e => {
  console.error('JS error:', e.error)
  showToast('❌ ' + (e.error?.message || e.message || 'Unknown error'))
})

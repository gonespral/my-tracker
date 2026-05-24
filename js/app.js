import { state } from './state.js'
import { supabase, db, setWorkoutConflictOverride } from './db.js'
import { TARGETS, hydrateCalorieTargets } from './config.js'
import { dateStr, nowTime } from './utils.js'
import { showToast, openSheet, closeSheets, toggleEntryMenu, closeMenus, bindSnapDrag } from './ui.js'
import { startListening, stopListening } from './speech.js'
import { openChat, clearChat, expandChatPanel, collapseChatPanel, hideChatPanel, toggleChatPanel, sendChatMessage, renderChat, setChatPanelState } from './ai.js'
import { renderToday, openFoodSheet, openFoodSheetWithPreset, openWorkoutSheet, editFood, editWorkout, saveToMeals } from './tabs/today.js'
import { renderNutrition } from './tabs/nutrition.js'
import { renderWorkouts } from './tabs/workouts.js'
import { renderSettings, openPresetSheet, deletePreset, openWorkoutPresetSheet, deleteWorkoutPreset } from './tabs/settings.js'
import { handleStravaCallback, syncStrava, stravaIsConnected } from './strava.js'
import { handleGoogleHealthCallback, syncGoogleHealth, googleHealthIsConnected } from './google-health.js'

function signIn() {
  supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

function updateSigninOverlay() {
  const overlay = document.getElementById('signin-overlay')
  if (overlay) overlay.style.display = state.currentUser ? 'none' : 'flex'
}

// ── Tab routing ────────────────────────────────────────────────
export async function renderActive() {
  try {
    if (state.activeTab === 'today')     await renderToday()
    if (state.activeTab === 'nutrition') await renderNutrition()
    if (state.activeTab === 'workouts')  await renderWorkouts()
  } catch (e) {
    console.error('Render error:', e)
    showToast('❌ ' + e.message)
  }
}

function switchTab(tab) {
  state.activeTab = tab
  localStorage.setItem('tracker-tab', tab)
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`))
  renderActive()
}

// ── Event delegation for dynamically-generated content ─────────
document.addEventListener('click', async (e) => {
  const actionEl = e.target.closest('[data-action]')
  if (!actionEl) return

  const action = actionEl.dataset.action
  const id     = actionEl.dataset.id
  const date   = actionEl.dataset.date
  const meal   = actionEl.dataset.meal

  switch (action) {
    case 'signin': signIn(); break

    case 'toggle-menu':
      toggleEntryMenu(actionEl)
      break

    case 'edit-food':
      editFood(id, date)
      break

    case 'save-to-meals':
      await saveToMeals(id, date)
      break

    case 'delete-food':
      closeMenus()
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
      try { await db.deleteWorkout(id); await renderActive() }
      catch (err) { showToast('❌ ' + err.message) }
      break

    case 'activate-workout-conflict':
      closeMenus()
      try {
        setWorkoutConflictOverride(actionEl.dataset.group, actionEl.dataset.source)
        db.bust()
        await renderActive()
        showToast('✅ Selected activity will count')
      } catch (err) { showToast('❌ ' + err.message) }
      break

    case 'open-workout-sheet':
      openWorkoutSheet(date || null)
      break

    case 'heatmap-month': {
      const offset = parseInt(actionEl.dataset.offset) || 0
      state.heatmapMonthOffset = offset
      await renderWorkouts(offset)
      break
    }

    case 'goto-activity-date': {
      const target = document.querySelector(`.workout-day-group[data-date="${date}"]`)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }

    case 'log-weight':
      state.pendingEditWeightDate = null
      document.getElementById('weight-sheet-title').textContent = 'Log weight'
      document.getElementById('w-edit-kg').value = ''
      openSheet('weight-edit-sheet')
      break

    case 'edit-weight': {
      closeMenus()
      const data = state.dbCache || await db.load()
      const entry = (data.weights || []).find(w => w.date === date)
      if (!entry) break
      state.pendingEditWeightDate = date
      document.getElementById('w-edit-kg').value = entry.kg
      document.getElementById('weight-sheet-title').textContent = 'Edit weight'
      openSheet('weight-edit-sheet')
      break
    }

    case 'delete-weight':
      closeMenus()
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

    case 'toggle-section': {
      const accordion = actionEl.closest('.accordion')
      if (accordion) accordion.classList.toggle('open')
      break
    }
  }
})

document.addEventListener('workout-conflict-pref-changed', async () => {
  db.bust()
  await renderActive()
})

// Close entry menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.entry-menu-wrap'))
    document.querySelectorAll('.entry-menu.open').forEach(m => m.classList.remove('open'))
})

// Close autocomplete on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-wrap'))
    document.getElementById('f-desc-ac')?.classList.remove('open')
})

// ── Main app init (runs after auth confirms user) ──────────────
async function initApp() {
  // Handle OAuth redirects before anything else
  await handleStravaCallback()
  await handleGoogleHealthCallback()

  // Load user's saved targets before any rendering
  try {
    const [s, data] = await Promise.all([db.loadSettings(), db.load()])
    if (s) {
      TARGETS.calories.rest     = s.cal_rest
      TARGETS.calories.training = s.cal_training
      TARGETS.protein           = s.protein_g
      TARGETS.carbs             = s.carbs_g
      TARGETS.fat               = s.fat_g
      const profile = {
        age: s.age_years ?? '',
        sex: s.sex ?? 'other',
        height_cm: s.height_cm ?? '',
        weight_kg: s.weight_kg ?? '',
        activity_level: s.activity_level ?? 'moderate',
      }
      hydrateCalorieTargets(profile, data?.weights?.[0]?.kg ?? null)
    }
  } catch (e) { console.warn('Settings load failed:', e.message) }

  if (window.innerWidth >= 768) {
    document.getElementById('stats-section').style.display = 'block'
    state.statsOpen = true
  }

  // Tabs — restore last active tab
  const savedTab = localStorage.getItem('tracker-tab')
  if (savedTab && savedTab !== 'today') switchTab(savedTab)

  document.querySelectorAll('.tab').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)))

  // ── Main chat input ──
  const mainInput = document.getElementById('main-input')
  const resizeInput = () => {
    mainInput.style.height = 'auto'
    mainInput.style.height = Math.min(mainInput.scrollHeight, window.innerHeight * 0.45) + 'px'
  }
  mainInput.addEventListener('input', resizeInput)

  const handleMainInput = async () => {
    const text = mainInput.value.trim()
    if (!text) return

    const chatPanel = document.getElementById('chat-panel')

    // While in an active chat session, always continue the conversation
    if (chatPanel.classList.contains('expanded')) {
      mainInput.value = ''
      resizeInput()
      await sendChatMessage(text, renderActive)
      return
    }

    // Try to match against saved meals before hitting Claude
    if (!state.mealsCache) {
      try { state.mealsCache = await db.loadMeals() } catch (_) {}
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
    openChat(text, renderActive)
  }

  document.getElementById('send-btn').addEventListener('click', handleMainInput)
  mainInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMainInput() }
  })
  mainInput.addEventListener('submit-input', handleMainInput)

  document.getElementById('chat-panel-handle').addEventListener('click', toggleChatPanel)
  document.getElementById('chat-peek-body').addEventListener('click', expandChatPanel)
  document.getElementById('chat-clear-btn').addEventListener('click', clearChat)
  document.getElementById('chat-collapse-btn').addEventListener('click', collapseChatPanel)

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
      for (const state of states.slice(1)) {
        const delta = Math.abs(height - state.height)
        if (delta < bestDelta) {
          best = state
          bestDelta = delta
        }
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
      const maxHeight = chatExpandedHeight()
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

  document.querySelectorAll('.sheet').forEach(sheet => {
    const handle = sheet.querySelector('.sheet-handle')
    if (!handle) return
    bindSnapDrag(handle, {
      targetEl: sheet,
      states: ['open', 'closed'],
      getState: () => sheet.classList.contains('open') ? 'open' : 'closed',
      setState: nextState => {
        if (nextState === 'closed') closeSheets()
      },
    })
  })

  // Sync --bar-h CSS var so chat panel positions above input bar
  const inputBarEl = document.querySelector('.input-bar')
  const syncBarHeight = () =>
    document.documentElement.style.setProperty('--bar-h', inputBarEl.offsetHeight + 'px')
  new ResizeObserver(syncBarHeight).observe(inputBarEl)
  syncBarHeight()

  // Re-render when tab becomes visible — db.load() handles token refresh internally
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderActive()
  })

  // ── Backdrop closes sheets and collapses chat ──
  document.getElementById('backdrop').addEventListener('click', () => {
    closeSheets()
    if (chatPanel.classList.contains('expanded')) collapseChatPanel()
    else if (chatPanel.classList.contains('peek')) hideChatPanel()
  })

  // ── Mic ──
  document.getElementById('mic-btn').addEventListener('click', () => {
    if (state.listening) stopListening(); else startListening()
  })

  // ── Theme toggle ──
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('tracker-theme', next)
  })

  // ── Settings button opens settings sheet ──
  document.getElementById('apikey-btn').addEventListener('click', async () => {
    try {
      await renderSettings()
      openSheet('settings-sheet')
    } catch (e) {
      console.error('Settings error:', e)
      showToast('❌ ' + e.message)
    }
  })
  document.getElementById('settings-close-btn').addEventListener('click', closeSheets)

  // ── Food sheet: meal pill selection ──
  document.getElementById('food-sheet').addEventListener('click', e => {
    const btn = e.target.closest('#food-sheet .meal-btn')
    if (!btn) return
    document.querySelectorAll('#food-sheet .meal-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })

  // ── Food sheet: autocomplete ──
  document.getElementById('f-desc').addEventListener('input', async e => {
    if (!state.mealsCache) {
      try { state.mealsCache = await db.loadMeals() } catch (_) { return }
    }
    updateAutocomplete(e.target.value)
  })

  // ── Food sheet: save / update ──
  document.getElementById('log-food-btn').addEventListener('click', async () => {
    const desc = document.getElementById('f-desc').value.trim()
    if (!desc) { document.getElementById('f-desc').focus(); return }
    const meal  = document.querySelector('#food-sheet .meal-btn.active')?.dataset.meal || 'breakfast'
    const entry = {
      description: desc,
      calories: Number(document.getElementById('f-cal').value) || 0,
      protein:  Number(document.getElementById('f-pro').value) || 0,
      carbs:    Number(document.getElementById('f-car').value) || 0,
      fat:      Number(document.getElementById('f-fat').value) || 0,
      meal,
    }
    const editId  = state.pendingEditFoodId
    const dateVal = document.getElementById('f-date').value || dateStr()
    document.getElementById('f-date').disabled = false
    closeSheets()
    try {
      if (editId) { await db.updateFood(editId, entry); showToast(`✅ Updated ${desc}`) }
      else        { await db.addFood(dateVal, entry);   showToast(`🍽️ Logged ${desc}`) }
      await renderActive()
    } catch (err) { showToast('❌ ' + (err.message || 'Save failed')) }
  })

  // ── Workout sheet: intensity toggle ──
  document.querySelectorAll('#intensity-btns-main .intensity-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#intensity-btns-main .intensity-btn').forEach(x => x.classList.remove('active'))
      b.classList.add('active')
    }))

  // ── Activity sheet: save / update ──
  document.getElementById('save-workout-btn').addEventListener('click', async () => {
    const desc = document.getElementById('w-desc').value.trim()
    if (!desc) { document.getElementById('w-desc').focus(); return }
    const intensity    = document.querySelector('#intensity-btns-main .intensity-btn.active')?.dataset.intensity || 'medium'
    const activityType = document.getElementById('w-activity-type').value || null
    const calsBurned   = Number(document.getElementById('w-calories-burned').value) || null
    const durationMin  = Number(document.getElementById('w-duration-min').value)    || null
    const distanceKm   = Number(document.getElementById('w-distance-km').value)     || null
    const heartRate    = Number(document.getElementById('w-heart-rate').value)      || null
    const dateVal      = document.getElementById('w-date').value || dateStr()
    const editId       = state.pendingEditWorkoutId
    document.getElementById('w-date').disabled = false
    closeSheets()
    try {
      if (editId) {
        await db.updateWorkout(editId, { description: desc, intensity, activity_type: activityType,
          calories_burned: calsBurned, duration_min: durationMin, distance_km: distanceKm, heart_rate_avg: heartRate })
        showToast(`✅ Updated ${desc}`)
      } else {
        await db.addWorkout(dateVal, { description: desc, intensity, activity_type: activityType,
          calories_burned: calsBurned, duration_min: durationMin, distance_km: distanceKm, heart_rate_avg: heartRate,
          duration: '', time: nowTime() })
        showToast(`${{ low: '😴', medium: '💪', high: '🔥' }[intensity]} Logged ${desc}`)
      }
      await renderActive()
    } catch (err) { showToast('❌ ' + (err.message || 'Save failed')) }
  })

  // ── Weight sheet ──
  document.getElementById('save-weight-btn').addEventListener('click', async () => {
    const kg = parseFloat(document.getElementById('w-edit-kg').value)
    if (!kg || isNaN(kg)) return
    const date = state.pendingEditWeightDate || dateStr()
    state.pendingEditWeightDate = null
    closeSheets()
    try {
      await db.upsertWeight({ kg, date, time: nowTime() })
      showToast('✅ Weight logged')
      await renderActive()
    } catch (err) { showToast('❌ ' + err.message) }
  })

  // ── Mobile stats toggle ──
  document.getElementById('stats-toggle')?.addEventListener('click', () => {
    state.statsOpen = !state.statsOpen
    const sec = document.getElementById('stats-section')
    const lbl = document.getElementById('toggle-label')
    const arr = document.getElementById('toggle-arrow')
    if (window.innerWidth < 768) sec.style.display = state.statsOpen ? 'block' : 'none'
    lbl.textContent = state.statsOpen ? 'Hide stats' : 'Stats'
    arr.textContent = state.statsOpen ? 'expand_less' : 'expand_more'
  })

  // ── Meal preset sheet: meal pill selection ──
  document.querySelectorAll('#mp-meal-btns .meal-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#mp-meal-btns .meal-btn').forEach(x => x.classList.remove('active'))
      b.classList.add('active')
    }))

  // ── Meal preset sheet: save ──
  document.getElementById('save-preset-btn').addEventListener('click', async () => {
    const name = document.getElementById('mp-name').value.trim()
    if (!name) { document.getElementById('mp-name').focus(); return }
    const entry = {
      name,
      calories: Number(document.getElementById('mp-cal').value) || 0,
      protein:  Number(document.getElementById('mp-pro').value) || 0,
      carbs:    Number(document.getElementById('mp-car').value) || 0,
      fat:      Number(document.getElementById('mp-fat').value) || 0,
      meal: document.querySelector('#mp-meal-btns .meal-btn.active')?.dataset.meal || 'snack',
    }
    const editId = state.pendingEditPresetId
    closeSheets()
    try {
      if (editId) { await db.updateMeal(editId, entry); showToast('✅ Meal updated') }
      else        { await db.addMeal(entry);             showToast('✅ Meal saved') }
      state.mealsCache = null
    } catch (err) { showToast('❌ ' + err.message) }
  })

  // ── Workout preset sheet: intensity toggle ──
  document.querySelectorAll('#wps-intensity-btns .intensity-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#wps-intensity-btns .intensity-btn').forEach(x => x.classList.remove('active'))
      b.classList.add('active')
    }))

  // ── Workout preset sheet: save ──
  document.getElementById('save-wps-btn').addEventListener('click', async () => {
    const name = document.getElementById('wps-name').value.trim()
    if (!name) { document.getElementById('wps-name').focus(); return }
    const entry = {
      name,
      intensity: document.querySelector('#wps-intensity-btns .intensity-btn.active')?.dataset.intensity || 'medium',
      calories_burned: Number(document.getElementById('wps-calories-burned').value) || null,
    }
    const editId = state.pendingEditWorkoutPresetId
    state.pendingEditWorkoutPresetId = null
    closeSheets()
    try {
      if (editId) { await db.updateWorkoutPreset(editId, entry); showToast('✅ Workout updated') }
      else        { await db.addWorkoutPreset(entry);             showToast('✅ Workout saved') }
      state.workoutPresetsCache = null
    } catch (err) { showToast('❌ ' + err.message) }
  })

  // ── API key sheet ──
  document.getElementById('save-apikey-btn').addEventListener('click', () => {
    const key = document.getElementById('apikey-input').value.trim()
    if (!key) return
    localStorage.setItem('tracker-anthropic-key', key)
    closeSheets()
    showToast('✅ API key saved')
  })

  // Pre-load caches and initial render
  if (state.currentUser) {
    db.loadMeals().then(m => { state.mealsCache = m }).catch(() => {})
    db.loadWorkoutPresets().then(w => { state.workoutPresetsCache = w }).catch(() => {})
  }

  await renderActive()

  // Auto-sync Strava after initial render (non-blocking)
  if (stravaIsConnected()) {
    syncStrava({ silent: true, onComplete: renderActive }).catch(e => console.warn('Strava sync:', e))
  }
  // Auto-sync Google Health after initial render (non-blocking)
  if (googleHealthIsConnected()) {
    syncGoogleHealth({ silent: true, onComplete: renderActive }).catch(e => console.warn('Google Health sync:', e))
  }
}

// ── Meal fuzzy matching ───────────────────────────────────────

// Words that signal a question or command — always route to Claude
const QUERY_RE = /\b(edit|delete|remove|update|change|modify|how|what|why|when|where|which|who|can|could|would|should|help|show|tell|find|is|are|was|were|did|does|do)\b/i

function mealSimilarity(input, mealName) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const a = norm(input)
  const b = norm(mealName)
  if (!a || !b) return 0
  if (a === b) return 1

  const ta = a.split(' ')
  const tbSet = new Set(b.split(' '))

  // Count words in input that don't appear in the meal name.
  // More than 1 extra word means it's likely a sentence, not a food reference.
  const extraWords = ta.filter(t => !tbSet.has(t))
  if (extraWords.length > 1) return 0

  const allTokens = new Set([...ta, ...tbSet])
  const hits = ta.filter(t => tbSet.has(t)).length
  const jaccard = hits / allTokens.size
  const containsBonus = (b.includes(a) || a.includes(b)) ? 0.15 : 0
  return Math.min(1, jaccard + containsBonus)
}

function findMatchingMeal(text) {
  // Questions and commands always go to Claude
  if (QUERY_RE.test(text) || text.includes('?')) return null

  const meals = state.mealsCache || []
  let best = null, bestScore = 0
  for (const m of meals) {
    const score = mealSimilarity(text, m.name)
    if (score > bestScore) { bestScore = score; best = m }
  }
  return bestScore >= 0.65 ? best : null
}

function updateAutocomplete(query) {
  const list  = document.getElementById('f-desc-ac')
  const meals = state.mealsCache || []
  const q     = query.toLowerCase().trim()
  if (!q || !meals.length) { list.classList.remove('open'); return }
  const matches = meals.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5)
  if (!matches.length) { list.classList.remove('open'); return }
  list.innerHTML = matches.map(m => `
    <div class="autocomplete-item" data-preset-id="${m.id}">
      <span class="autocomplete-item-name">${m.name}</span>
      <span class="autocomplete-item-cal">${Math.round(m.calories)} kcal</span>
    </div>`).join('')
  list.classList.add('open')

  list.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      const m = (state.mealsCache || []).find(x => x.id === item.dataset.presetId)
      if (!m) return
      document.getElementById('f-desc').value = m.name
      document.getElementById('f-cal').value  = m.calories || ''
      document.getElementById('f-pro').value  = m.protein  || ''
      document.getElementById('f-car').value  = m.carbs    || ''
      document.getElementById('f-fat').value  = m.fat      || ''
      if (m.meal) document.querySelectorAll('#food-sheet .meal-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.meal === m.meal))
      list.classList.remove('open')
      document.getElementById('f-cal').focus()
    })
  })
}

// ── Auth ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Read session from localStorage — fast, handles OAuth callback URL params too
  const { data: { session } } = await supabase.auth.getSession()
  state.currentUser = session?.user ?? null

  await initApp()
  updateSigninOverlay()

  // Re-render on any auth change (sign in, sign out, token refresh)
  supabase.auth.onAuthStateChange((event, session) => {
    state.currentUser = session?.user ?? null
    state.dbCache     = null
    updateSigninOverlay()
    renderActive()
  })
})

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled rejection:', e.reason)
  showToast('❌ ' + (e.reason?.message || 'Unknown error'))
})
window.addEventListener('error', e => {
  console.error('JS error:', e.error)
  showToast('❌ ' + (e.error?.message || e.message || 'Unknown error'))
})

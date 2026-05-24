import { TARGETS } from './config.js'
import { state } from './state.js'
import { db } from './db.js'
import { dateStr, nowTime, fmtDate, fmtDateShort, fmt, round, sumFood } from './utils.js'
import { openSheet, showToast, syncBackdrop } from './ui.js'

export const CLAUDE_TOOLS = [
  {
    name: 'log_food',
    description: 'Log a food/drink entry. Works for today or any past date. Estimate calories and macros if not stated; use saved meal preset values when the name matches.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        calories:    { type: 'number', description: 'kcal' },
        protein:     { type: 'number', description: 'grams' },
        carbs:       { type: 'number', description: 'grams' },
        fat:         { type: 'number', description: 'grams' },
        meal:        { type: 'string', enum: ['breakfast','lunch','snack','dinner'] },
        date:        { type: 'string', description: 'YYYY-MM-DD — omit for today' },
      },
      required: ['description', 'calories'],
    },
  },
  {
    name: 'edit_food',
    description: 'Edit an existing food entry. Only include fields that should change.',
    input_schema: {
      type: 'object',
      properties: {
        id:          { type: 'string' },
        description: { type: 'string' },
        calories:    { type: 'number' },
        protein:     { type: 'number' },
        carbs:       { type: 'number' },
        fat:         { type: 'number' },
        meal:        { type: 'string', enum: ['breakfast','lunch','snack','dinner'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_food',
    description: 'Delete a food entry by ID.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'log_workout',
    description: 'Log an activity for today or any past date.',
    input_schema: {
      type: 'object',
      properties: {
        description:     { type: 'string' },
        intensity:       { type: 'string', enum: ['low','medium','high'] },
        calories_burned: { type: 'number', description: 'kcal burned (optional)' },
        duration_min:    { type: 'number', description: 'duration in minutes (optional)' },
        distance_km:     { type: 'number', description: 'distance in km (optional)' },
        heart_rate_avg:  { type: 'number', description: 'average heart rate in bpm (optional)' },
        date:            { type: 'string', description: 'YYYY-MM-DD — omit for today' },
      },
      required: ['description', 'intensity'],
    },
  },
  {
    name: 'edit_workout',
    description: 'Edit an existing activity entry. Only include fields that should change.',
    input_schema: {
      type: 'object',
      properties: {
        id:              { type: 'string' },
        description:     { type: 'string' },
        intensity:       { type: 'string', enum: ['low','medium','high'] },
        calories_burned: { type: 'number' },
        duration_min:    { type: 'number' },
        distance_km:     { type: 'number' },
        heart_rate_avg:  { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_workout',
    description: 'Delete a workout entry by ID.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'log_weight',
    description: 'Log a body weight measurement for today or any past date.',
    input_schema: {
      type: 'object',
      properties: {
        kg:   { type: 'number' },
        date: { type: 'string', description: 'YYYY-MM-DD — omit for today' },
      },
      required: ['kg'],
    },
  },
  {
    name: 'save_meal_preset',
    description: 'Save a food item as a reusable meal preset.',
    input_schema: {
      type: 'object',
      properties: {
        name:     { type: 'string' },
        calories: { type: 'number' },
        protein:  { type: 'number', description: 'grams' },
        carbs:    { type: 'number', description: 'grams' },
        fat:      { type: 'number', description: 'grams' },
        meal:     { type: 'string', enum: ['breakfast','lunch','snack','dinner'] },
      },
      required: ['name', 'calories'],
    },
  },
  {
    name: 'set_targets',
    description: "Update the user's daily calorie and macro targets. Only include fields that should change.",
    input_schema: {
      type: 'object',
      properties: {
        cal_rest:     { type: 'number', description: 'Rest day calorie target (kcal)' },
        cal_training: { type: 'number', description: 'Training day calorie target (kcal)' },
        protein_g:    { type: 'number', description: 'Daily protein target (grams)' },
        carbs_g:      { type: 'number', description: 'Daily carbs target (grams)' },
        fat_g:        { type: 'number', description: 'Daily fat target (grams)' },
      },
    },
  },
]

export async function buildClaudeSystem() {
  const data     = await db.load()
  const meals    = state.mealsCache || []
  const today    = dateStr()
  const food     = data.food[today]     || []
  const workouts = data.workouts[today] || []
  const totals   = sumFood(food)
  const weights  = data.weights || []
  const training  = workouts.some(w => !w.isDuplicate)
  const calTarget = training ? TARGETS.calories.training : TARGETS.calories.rest
  const remaining = calTarget - totals.calories

  const mealsList = meals.length
    ? meals.map(m => `  • ${m.name}: ${m.calories} kcal, P${m.protein}g C${m.carbs}g F${m.fat}g (${m.meal||'snack'})`).join('\n')
    : '  (none saved yet)'

  const recentLines = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const df = data.food[ds] || [], dw = data.workouts[ds] || []
    if (!df.length && !dw.length) continue
    recentLines.push(`${fmtDateShort(ds)}${i===0?' (today)':''}`+':')
    df.forEach(e => recentLines.push(`  food     [${e.id}] ${e.description} — ${round(e.calories)} kcal (${e.meal||'snack'})`))
    dw.forEach(e => recentLines.push(`  workout  [${e.id}] ${e.description} (${e.intensity})${e.calories_burned?' '+e.calories_burned+' kcal burned':''}`))
  }

  const burnedToday = workouts.reduce((s, w) => s + (w.calories_burned || 0), 0)
  const effectiveTarget = calTarget + burnedToday

  return `You are a concise fitness tracking assistant embedded in the user's personal tracker app.
Today: ${fmtDate(today)} (${today})
Calories today: ${round(totals.calories)} / ${effectiveTarget} kcal (${round(effectiveTarget - totals.calories)} remaining)${burnedToday > 0 ? ` [base ${calTarget} + ${burnedToday} burned]` : ''}
Protein: ${fmt(totals.protein)}g / ${TARGETS.protein}g  Carbs: ${fmt(totals.carbs)}g / ${TARGETS.carbs}g  Fat: ${fmt(totals.fat)}g / ${TARGETS.fat}g
Current targets: rest ${TARGETS.calories.rest} kcal / training ${TARGETS.calories.training} kcal / P${TARGETS.protein}g C${TARGETS.carbs}g F${TARGETS.fat}g
Latest weight: ${weights[0] ? weights[0].kg.toFixed(1)+' kg ('+fmtDateShort(weights[0].date)+')' : 'not logged'}

Recent log (last 7 days) — use IDs to edit or delete:
${recentLines.length ? recentLines.join('\n') : '  (empty)'}

Saved meal presets:
${mealsList}

Rules:
- Log food/workouts/weight for ANY date the user mentions. Use YYYY-MM-DD format.
- To edit, call edit_food or edit_workout with the entry ID. Only send changed fields.
- You may call multiple tools in one turn.
- Estimate calories/macros from context; use preset values when name matches.
- Keep replies concise. No markdown.`
}

export async function callClaudeApi(messages, system) {
  const key = localStorage.getItem('tracker-anthropic-key') || ''
  if (!key) { openSheet('apikey-sheet'); throw new Error('No API key') }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 512, system, tools: CLAUDE_TOOLS, messages }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${r.status}`)
  }
  return r.json()
}

export async function executeTool(name, input) {
  try {
    const date = input.date || dateStr()
    if (name === 'log_food') {
      await db.addFood(date, { description: input.description, calories: input.calories||0, protein: input.protein||0, carbs: input.carbs||0, fat: input.fat||0, meal: input.meal||'snack' })
      return `logged for ${date}`
    }
    if (name === 'edit_food') {
      const fields = {}
      if (input.description !== undefined) fields.description = input.description
      if (input.calories    !== undefined) fields.calories    = input.calories
      if (input.protein     !== undefined) fields.protein     = input.protein
      if (input.carbs       !== undefined) fields.carbs       = input.carbs
      if (input.fat         !== undefined) fields.fat         = input.fat
      if (input.meal        !== undefined) fields.meal        = input.meal
      await db.updateFood(input.id, fields)
      return 'updated'
    }
    if (name === 'delete_food')    { await db.deleteFood(input.id); return 'deleted' }
    if (name === 'log_workout') {
      await db.addWorkout(date, { description: input.description, intensity: input.intensity,
        calories_burned: input.calories_burned||null, duration_min: input.duration_min||null,
        distance_km: input.distance_km||null, heart_rate_avg: input.heart_rate_avg||null,
        duration: '', time: nowTime() })
      return `logged for ${date}`
    }
    if (name === 'edit_workout') {
      const fields = {}
      if (input.description     !== undefined) fields.description     = input.description
      if (input.intensity       !== undefined) fields.intensity       = input.intensity
      if (input.calories_burned !== undefined) fields.calories_burned = input.calories_burned
      if (input.duration_min    !== undefined) fields.duration_min    = input.duration_min
      if (input.distance_km     !== undefined) fields.distance_km     = input.distance_km
      if (input.heart_rate_avg  !== undefined) fields.heart_rate_avg  = input.heart_rate_avg
      await db.updateWorkout(input.id, fields)
      return 'updated'
    }
    if (name === 'delete_workout')  { await db.deleteWorkout(input.id); return 'deleted' }
    if (name === 'log_weight')      { await db.upsertWeight({ kg: input.kg, date, time: nowTime() }); return `logged for ${date}` }
    if (name === 'save_meal_preset') {
      await db.addMeal({ name: input.name, calories: input.calories||0, protein: input.protein||0, carbs: input.carbs||0, fat: input.fat||0, meal: input.meal||'snack' })
      state.mealsCache = null
      return `saved "${input.name}" as meal preset`
    }
    if (name === 'set_targets') {
      if (input.cal_rest     !== undefined) TARGETS.calories.rest     = input.cal_rest
      if (input.cal_training !== undefined) TARGETS.calories.training = input.cal_training
      if (input.protein_g    !== undefined) TARGETS.protein           = input.protein_g
      if (input.carbs_g      !== undefined) TARGETS.carbs             = input.carbs_g
      if (input.fat_g        !== undefined) TARGETS.fat               = input.fat_g
      await db.saveSettings({
        cal_rest: TARGETS.calories.rest, cal_training: TARGETS.calories.training,
        protein_g: TARGETS.protein, carbs_g: TARGETS.carbs, fat_g: TARGETS.fat,
      })
      return 'targets updated'
    }
    return 'unknown tool'
  } catch (e) { return `error: ${e.message}` }
}

const THINKING_VERBS = [
  'Ruminating','Cogitating','Metamorphosizing','Percolating','Marinating',
  'Philosophizing','Triangulating','Osmosing','Defragmenting','Manifesting',
  'Circumnavigating','Vibing','Transubstantiating','Discombobulating',
  'Recalibrating','Quantum tunneling','Yodeling internally',
  'Spellchecking the cosmos','Decalcifying','Extrapolating aggressively',
  'Scheming','Reverse engineering breakfast','Doing math (allegedly)',
]
export const thinkingVerb = () => THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)]

const CHAT_COLLAPSED_HEIGHT = '18px'
const CHAT_PEEK_HEIGHT = '75px'

function getChatPanelState(panel = document.getElementById('chat-panel')) {
  if (!panel) return 'collapsed'
  if (panel.classList.contains('expanded')) return 'expanded'
  if (panel.classList.contains('peek')) return 'peek'
  return 'collapsed'
}

function syncChatPanelLayout(stateName) {
  document.documentElement.style.setProperty('--chat-peek-h', stateName === 'collapsed' ? CHAT_COLLAPSED_HEIGHT : CHAT_PEEK_HEIGHT)
  syncBackdrop()
}

export function setChatPanelState(nextState) {
  const panel = document.getElementById('chat-panel')
  if (!panel) return
  panel.classList.remove('dragging')
  panel.style.height = ''
  panel.classList.remove('collapsed', 'peek', 'expanded')
  panel.classList.add(nextState)

  const inp = document.getElementById('main-input')
  if (inp) inp.placeholder = nextState === 'expanded' ? 'Reply to Claude…' : 'Type something…'

  syncChatPanelLayout(nextState)

  if (nextState === 'expanded') {
    setTimeout(() => document.getElementById('chat-messages')?.scrollTo(0, 999999), 50)
  }
}

export function renderChat() {
  const el = document.getElementById('chat-messages')
  if (!el) return
  el.innerHTML = state.chatDisplay.map(m =>
    `<div class="chat-bubble ${m.role}${m.thinking ? ' thinking' : ''}">${m.text}</div>`).join('')
  el.scrollTop = el.scrollHeight

  const last = [...state.chatDisplay].reverse().find(m => m.role === 'assistant')
  if (last) {
    const panel = document.getElementById('chat-panel')
    const peekText = document.getElementById('chat-peek-text')
    if (peekText) {
      peekText.textContent = last.text
      peekText.classList.toggle('thinking', !!last.thinking)
    }
    if (panel && !panel.classList.contains('expanded') && !panel.classList.contains('collapsed')) {
      panel.classList.add('peek')
      syncChatPanelLayout('peek')
    }
  }
}

export function expandChatPanel() {
  setChatPanelState('expanded')
}

export function collapseChatPanel() {
  setChatPanelState('peek')
}

export function hideChatPanel() {
  setChatPanelState('collapsed')
}

export function toggleChatPanel() {
  const panel = document.getElementById('chat-panel')
  if (!panel) return
  if (panel.classList.contains('expanded')) collapseChatPanel()
  else if (panel.classList.contains('peek')) expandChatPanel()
  else collapseChatPanel()
}

export function clearChat() {
  state.chatApiMessages = []
  state.chatDisplay     = []
  const el = document.getElementById('chat-messages')
  if (el) el.innerHTML = ''
  const peekText = document.getElementById('chat-peek-text')
  if (peekText) peekText.textContent = ''
  setChatPanelState('collapsed')
}

export async function sendChatMessage(text, renderActiveFn) {
  text = text.trim()
  if (!text) return
  state.chatDisplay.push({ role: 'user', text })
  state.chatApiMessages.push({ role: 'user', content: text })
  state.chatDisplay.push({ role: 'assistant', text: thinkingVerb() + '…', thinking: true })
  renderChat()

  try {
    const system = await buildClaudeSystem()
    let replyText = ''
    let currentMessages = state.chatApiMessages

    for (let round = 0; round < 5; round++) {
      const msg = await callClaudeApi(currentMessages, system)
      const toolCalls = msg.content.filter(b => b.type === 'tool_use')
      replyText = msg.content.find(b => b.type === 'text')?.text || ''

      if (!toolCalls.length) {
        state.chatApiMessages.push({ role: 'assistant', content: msg.content })
        break
      }
      const toolResults = await Promise.all(toolCalls.map(async tc => ({
        type: 'tool_result', tool_use_id: tc.id, content: String(await executeTool(tc.name, tc.input))
      })))
      state.chatApiMessages.push({ role: 'assistant', content: msg.content })
      state.chatApiMessages.push({ role: 'user', content: toolResults })
      currentMessages = state.chatApiMessages
    }

    state.chatDisplay.pop()
    if (replyText) state.chatDisplay.push({ role: 'assistant', text: replyText })
  } catch (e) {
    state.chatDisplay.pop()
    state.chatDisplay.push({ role: 'assistant', text: '❌ ' + e.message })
  }

  renderChat()
  if (renderActiveFn) await renderActiveFn()
}

export function openChat(initialText, renderActiveFn) {
  const key = localStorage.getItem('tracker-anthropic-key') || ''
  if (!key) { openSheet('apikey-sheet'); return }
  if (initialText) {
    setChatPanelState('peek')
    sendChatMessage(initialText, renderActiveFn)
  }
}

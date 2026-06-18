import { TARGETS } from './config.js'
import { state } from './state.js'
import { db, isDemo } from './db.js'
import { dateStr, nowTime, fmtDate, fmtDateShort, fmt, round, sumFood } from './utils.js'
import { openSheet, closeSheets, showToast, syncBackdrop } from './ui.js'
import { searchFoodDatabase, safeCalc } from './food-db.js'

export const claudeDraftConfirmationEnabled = () => state.settings?.claude_draft_confirm ?? true

export function setClaudeDraftConfirmationEnabled(enabled) {
  state.settings.claude_draft_confirm = !!enabled
  db.saveSettings({ claude_draft_confirm: !!enabled }).catch(() => {})
}

export const CLAUDE_TOOLS = [
  {
    name: 'lookup_food',
    description: 'Search real nutrition databases (USDA FoodData Central for generic/home-cooked foods, Open Food Facts for branded/packaged products including European brands) for per-100g nutrition data. Always call this before estimating calories for log_food, edit_food, or save_meal_preset, unless the user gave explicit calorie numbers or the food exactly matches a saved preset. Returns the closest matches with kcal/protein/carbs/fat per 100g — use calculate to scale to the actual portion.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Food name to search, e.g. "chicken breast cooked"' } },
      required: ['query'],
    },
  },
  {
    name: 'calculate',
    description: 'Evaluate a basic arithmetic expression (+ - * / parentheses) to scale per-100g nutrition data to an actual portion size, or to sum multiple items. Always use this instead of doing the math yourself.',
    input_schema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'e.g. "165 * 1.5" for a 150g portion of a 110kcal/100g food' } },
      required: ['expression'],
    },
  },
  {
    name: 'log_food',
    description: 'Log a food/drink entry. Works for today or any past date. Use saved meal preset values when the name matches, otherwise use lookup_food + calculate to get real values before logging.',
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

function normFood(s) {
  return s.toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(g|ml|oz|x|kg|lb|cup|tbsp|tsp|piece|slice|scoop)s?\b/gi, '')
    .replace(/\b(large|medium|small|big|half|whole|extra)\b/gi, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function frequentFoodsNotPreset(data, presets) {
  const normPresets = new Set(presets.map(p => normFood(p.name)))
  const counts = {}
  const examples = {}
  for (const entries of Object.values(data.food || {})) {
    for (const e of entries) {
      const key = normFood(e.description)
      if (!key) continue
      counts[key] = (counts[key] || 0) + 1
      if (!examples[key]) examples[key] = e
    }
  }
  return Object.entries(counts)
    .filter(([key, n]) => n >= 2 && !normPresets.has(key))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, n]) => ({ key, count: n, entry: examples[key] }))
}

export async function buildClaudeSystem() {
  const data     = await db.load()
  const meals    = state.mealsCache || []
  const today    = dateStr()
  const food     = data.food[today]     || []
  const workouts = data.workouts[today] || []
  const totals   = sumFood(food)
  const weights  = data.weights || []
  const training  = workouts.some(w => !w.isDuplicate)
  const calTarget = TARGETS.calories.goal || TARGETS.calories.rest
  const remaining = calTarget - totals.calories

  const mealsList = meals.length
    ? meals.map(m => `  • ${m.name}: ${m.calories} kcal, P${m.protein}g C${m.carbs}g F${m.fat}g (${m.meal||'snack'})`).join('\n')
    : '  (none saved yet)'

  const recentLines = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const calTarget = TARGETS.calories.goal || TARGETS.calories.rest
    const df = data.food[ds] || []
    const dw = data.workouts[ds] || []
    if (!df.length && !dw.length) continue
    recentLines.push(`${fmtDateShort(ds)}${i===0?' (today)':''}`+':')
    df.forEach(e => recentLines.push(`  food     [${e.id}] ${e.description} — ${round(e.calories)} kcal (${e.meal||'snack'})`))
    dw.forEach(e => recentLines.push(`  workout  [${e.id}] ${e.description} (${e.intensity})${e.calories_burned?' '+e.calories_burned+' kcal burned':''}`))
  }

  const burnedToday = workouts.reduce((s, w) => s + (w.calories_burned || 0), 0)
  const eatbackPct  = TARGETS.calories.eatback_enabled !== false ? (TARGETS.calories.eatback_pct ?? 50) : 0
  const eatback     = burnedToday > 0 ? Math.round(burnedToday * eatbackPct / 100) : 0
  const effectiveTarget = calTarget + eatback

  const frequent = frequentFoodsNotPreset(data, meals)
  const autoSave  = frequent.filter(f => f.count >= 3)
  const suggest   = frequent.filter(f => f.count === 2)
  const autoSaveSection = autoSave.length
    ? `\nAUTO-SAVE REQUIRED — call save_meal_preset immediately for each of these (logged 3+ times, not yet a preset):\n${autoSave.map(f => `  • "${f.entry.description}" x${f.count} — cal:${round(f.entry.calories)} P:${round(f.entry.protein)}g C:${round(f.entry.carbs)}g F:${round(f.entry.fat)}g meal:${f.entry.meal||'snack'}`).join('\n')}`
    : ''
  const suggestSection = suggest.length
    ? `\nFrequently logged but not yet preset (logged 2 times — suggest saving): ${suggest.map(f => `"${f.entry.description}"`).join(', ')}`
    : ''

  return `You are a concise fitness tracking assistant embedded in the user's personal tracker app.
Today: ${fmtDate(today)} (${today})
Calories today: ${round(totals.calories)} / ${effectiveTarget} kcal (${round(effectiveTarget - totals.calories)} remaining)${burnedToday > 0 ? ` [burned ${burnedToday} kcal, eating back ${eatbackPct}% = +${eatback} kcal]` : ''}
Protein: ${fmt(totals.protein)}g / ${TARGETS.protein}g  Carbs: ${fmt(totals.carbs)}g / ${TARGETS.carbs}g  Fat: ${fmt(totals.fat)}g / ${TARGETS.fat}g
Current targets: goal ${calTarget} kcal + ${eatback} eat-back = ${effectiveTarget} kcal today / P${TARGETS.protein}g C${TARGETS.carbs}g F${TARGETS.fat}g
Latest weight: ${weights[0] ? weights[0].kg.toFixed(1)+' kg ('+fmtDateShort(weights[0].date)+')' : 'not logged'}

Recent log (last 7 days) — use IDs to edit or delete:
${recentLines.length ? recentLines.join('\n') : '  (empty)'}

Saved meal presets:
${mealsList}
${autoSaveSection}${suggestSection}
Rules:
- Log food/workouts/weight for ANY date the user mentions. Use YYYY-MM-DD format.
  Current targets: maintenance ${TARGETS.calories.rest} kcal / goal ${TARGETS.calories.goal || TARGETS.calories.rest} kcal / P${TARGETS.protein}g C${TARGETS.carbs}g F${TARGETS.fat}g
- You may call multiple tools in one turn (e.g. lookup_food + calculate + log_food together).
- Before calling log_food, edit_food, or save_meal_preset for any food whose calories the user did NOT explicitly state, and that doesn't exactly match a saved preset above: first call lookup_food, then call calculate to scale the matched per-100g values to the actual portion eaten. Never invent calorie/macro numbers from memory when these tools are available.
- If lookup_food returns no usable match or a rate-limited error, call it at most once for that food — do not retry with a reworded/rephrased query. Just say so and estimate from context as a last resort.
- If the AUTO-SAVE REQUIRED section lists any foods, call save_meal_preset for each one in this response — do not wait, do not ask.
- For foods in the suggest section, mention once that they could be saved as a preset (one short sentence).
- Reply exactly like a text message to a friend: plain prose only, 1-2 sentences max. Never use markdown formatting of any kind — no **bold**, no _italics_, no tables, no bullet/numbered lists, no headers, no code blocks, no backticks, no em dashes, no emojis unless the user used one first. Plain words and punctuation only, every single reply, no exceptions.`
}

const DEMO_REPLIES = [
  "Got it, logged that for you!",
  "Nice, that fits well within today's targets.",
  "Saved! Let me know if there's anything else to log.",
  "Logged it. You're tracking well today.",
  "Done — that's noted in your log now.",
]

const DEMO_WISDOM = [
  "You're averaging a solid protein intake this week — keep it up.",
  "Training days look well balanced against your rest days.",
  "Your calorie logging has been consistent for the past week, nice work.",
  "Protein intake is trending close to your target most days.",
  "Activity levels are steady — a good rhythm to maintain this week.",
]

export async function fetchDailyWisdom() {
  if (!state.currentUser) return null

  const today = dateStr()
  const cacheKey = `tracker-wisdom-${state.currentUser.id}`
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey))
    if (cached?.date === today) return cached.text
  } catch (_) {}

  if (isDemo) {
    const text = DEMO_WISDOM[Math.floor(Math.random() * DEMO_WISDOM.length)]
    try { localStorage.setItem(cacheKey, JSON.stringify({ date: today, text })) } catch (_) {}
    return text
  }

  const key = localStorage.getItem('tracker-anthropic-key') || ''
  if (!key) return null

  const data = await db.load()
  const weights = data.weights || []

  // 7-day summaries
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    const workouts = data.workouts[ds] || []
    const t = sumFood(food)
    days.push({ ds, food, workouts, cal: t.calories, pro: t.protein, carbs: t.carbs, fat: t.fat })
  }

  const loggedDays = days.filter(d => d.food.length > 0)
  const avgCal  = loggedDays.length ? round(loggedDays.reduce((s, d) => s + d.cal,   0) / loggedDays.length) : 0
  const avgPro  = loggedDays.length ? round(loggedDays.reduce((s, d) => s + d.pro,   0) / loggedDays.length) : 0
  const avgCarb = loggedDays.length ? round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length) : 0
  const avgFat  = loggedDays.length ? round(loggedDays.reduce((s, d) => s + d.fat,   0) / loggedDays.length) : 0
  const workoutDays = days.filter(d => d.workouts.length > 0).length

  const activityLog = days
    .filter(d => d.workouts.length > 0)
    .map(d => {
      const acts = d.workouts.map(w => {
        const parts = [w.description, w.intensity]
        if (w.duration_min) parts.push(`${w.duration_min}min`)
        if (w.calories_burned) parts.push(`${w.calories_burned}kcal burned`)
        if (w.distance_km) parts.push(`${w.distance_km}km`)
        return parts.join(' ')
      }).join(', ')
      return `${fmtDateShort(d.ds)}: ${acts}`
    }).join('\n') || 'none'

  const weightLine = weights.length >= 2
    ? `Weight: ${weights[0].kg.toFixed(1)} kg now vs ${weights[Math.min(weights.length-1, 6)].kg.toFixed(1)} kg ${Math.min(weights.length-1, 6)} entries ago`
    : weights.length === 1 ? `Weight: ${weights[0].kg.toFixed(1)} kg (only one reading)` : 'Weight: not logged'

  const prompt = `You are a concise health insight generator. Given 7 days of tracking data, output ONE specific observation the user should know. Pick the single most useful insight from: goal adherence, nutrition trends, protein/calorie gaps, training frequency, activity variety, training load/intensity, rest vs training balance, weight trend.

Today: ${fmtDate(today)}
Targets: ${TARGETS.calories.rest} kcal maintenance / ${TARGETS.calories.goal || TARGETS.calories.rest} kcal goal / P${TARGETS.protein}g C${TARGETS.carbs}g F${TARGETS.fat}g
7-day nutrition averages (${loggedDays.length} days logged): ${avgCal} kcal / P${avgPro}g C${avgCarb}g F${avgFat}g
Workout days in last 7: ${workoutDays}/7
Activity log:
${activityLog}
${weightLine}
Today logged: ${days[0].cal} kcal / P${days[0].pro}g C${days[0].carbs}g F${days[0].fat}g, ${days[0].workouts.length} workout(s)

Rules: one sentence, no markdown, no em dashes, no emojis, no lists, strictly informative, write like a short text message.`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: prompt,
        messages: [{ role: 'user', content: 'Give me one insight.' }],
      }),
    })
    if (!r.ok) return null
    const msg = await r.json()
    const text = msg.content.find(b => b.type === 'text')?.text?.trim() || null
    if (text) localStorage.setItem(cacheKey, JSON.stringify({ date: today, text }))
    return text
  } catch (_) { return null }
}

let _abortController = null
export const isChatLoading = () => _abortController !== null
export function abortChat() {
  if (_abortController) {
    _abortController.abort()
    _abortController = null
  }
}

export async function callClaudeApi(messages, system, signal) {
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
    signal,
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${r.status}`)
  }
  return r.json()
}

// Localized small helper used when rendering a temporary assistant "thinking" message.
function thinkingVerb() {
  return 'Thinking'
}

// Surfaces which tools/databases Claude is using, so lookups against the food
// database (or any other tool call) are visible to the user — both while in
// flight (the "thinking" bubble) and afterwards as a persistent log line.
function toolCallLabel(tc) {
  switch (tc.name) {
    case 'lookup_food':      return `Checking food database for "${tc.input?.query || '…'}"`
    case 'calculate':        return 'Calculating'
    case 'log_food':         return `Logging "${tc.input?.description || 'food'}"`
    case 'edit_food':        return 'Updating food entry'
    case 'delete_food':      return 'Deleting food entry'
    case 'log_workout':      return `Logging "${tc.input?.description || 'activity'}"`
    case 'edit_workout':     return 'Updating activity'
    case 'delete_workout':   return 'Deleting activity'
    case 'log_weight':       return 'Logging weight'
    case 'save_meal_preset': return `Saving "${tc.input?.name || 'meal'}" as preset`
    case 'set_targets':      return 'Updating targets'
    default:                 return 'Working'
  }
}

function statusForToolCalls(toolCalls) {
  return [...new Set(toolCalls.map(toolCallLabel))].join(', ') + '…'
}

const TOOL_GROUP_LABEL = {
  lookup_food: 'Checking food database',
  log_food: 'Logging food',
  edit_food: 'Updating food entries',
  delete_food: 'Deleting food entries',
  log_workout: 'Logging activities',
  edit_workout: 'Updating activities',
  delete_workout: 'Deleting activities',
  log_weight: 'Logging weight',
  save_meal_preset: 'Saving presets',
  set_targets: 'Updating targets',
}

// A meal with several items fires several lookup_food/log_food calls in one
// round — one chat line per item gets noisy fast. Group same-tool calls in a
// round into a single line ("Checking food database (8 items)") and only
// show the red icon if any of them failed.
function groupToolCalls(executed) {
  const order = []
  const groups = new Map()
  for (const { tc, content } of executed) {
    if (!groups.has(tc.name)) { groups.set(tc.name, { count: 0, failed: false, tc }); order.push(tc.name) }
    const g = groups.get(tc.name)
    g.count++
    g.failed = g.failed || toolCallFailed(tc.name, content)
  }
  return order.map(name => {
    const g = groups.get(name)
    const label = g.count > 1 ? `${TOOL_GROUP_LABEL[name] || 'Working'} (${g.count} items)` : toolCallLabel(g.tc)
    return { label, ok: !g.failed }
  })
}

// A tool call counts as failed if executeTool caught an error, or — for
// lookup_food specifically — if the database search came back empty.
function toolCallFailed(name, resultContent) {
  if (typeof resultContent === 'string' && resultContent.startsWith('error:')) return true
  if (name === 'lookup_food') {
    try { return !!JSON.parse(resultContent)?.error } catch (_) { return false }
  }
  return false
}

// Internal bookkeeping tools (just arithmetic) clutter the chat log without
// telling the user anything new — keep them out of the visible tool-log row,
// but they're still fully captured in the console debug trace below.
const SILENT_TOOLS = new Set(['calculate'])

// Full debug trace of everything Claude does for a turn — tool calls with
// their inputs/outputs, any text/thinking content, per round. Anthropic's
// extended-thinking content blocks (type 'thinking') aren't requested by this
// app's API call (no `thinking` param — it would slow down and cost more for
// a chat that's meant to feel instant), so there's normally nothing there to
// log; this still surfaces it if it's ever enabled.
function logClaudeRound(round, msg, executed) {
  console.groupCollapsed(`[claude] round ${round + 1}`)
  for (const block of msg.content) {
    if (block.type === 'thinking') console.log('thinking:', block.thinking)
    if (block.type === 'text') console.log('text:', block.text)
  }
  for (const { tc, content } of executed) {
    console.log(`tool_use: ${tc.name}`, tc.input, '->', content)
  }
  console.groupEnd()
}

const CHAT_COLLAPSED_HEIGHT = '18px'
const CHAT_PEEK_HEIGHT = '75px'

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
  if (inp) inp.placeholder = 'Type something…'

  syncChatPanelLayout(nextState)
}

export function renderChat() {
  const el = document.getElementById('chat-messages')
  if (!el) return
  el.innerHTML = state.chatDisplay.map(m => {
    if (m.role === 'tool') {
      return `<div class="chat-tool-row">${m.items.map(it => `
        <span class="chat-tool-item${it.ok ? '' : ' fail'}">
          <span class="material-symbols-outlined chat-tool-icon">${it.ok ? 'travel_explore' : 'error'}</span>
          ${it.label}
        </span>`).join('')}</div>`
    }
    const imgLabel = m.imageCount ? `<span class="chat-img-label">📎 ${m.imageCount} image${m.imageCount > 1 ? 's' : ''} attached</span>` : ''
    const bubble = `<div class="chat-bubble ${m.role}${m.thinking ? ' thinking' : ''}">${m.text}${imgLabel}</div>`
    if (m.role === 'assistant') {
      return `<div class="chat-assistant-row"><span class="chat-claude-icon material-symbols-outlined">robot_2</span>${bubble}</div>`
    }
    return bubble
  }).join('')
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
  else if (panel.classList.contains('peek')) { if (state.chatDisplay.length > 0) expandChatPanel() }
  else if (state.chatDisplay.length > 0) collapseChatPanel()
}

export function clearChat() {
  state.chatApiMessages = []
  state.chatDisplay     = []
  const el = document.getElementById('chat-messages')
  if (el) el.innerHTML = ''
  const peekText = document.getElementById('chat-peek-text')
  if (peekText) peekText.textContent = ''
  setChatPanelState('collapsed')
  if (chatStorageKey()) localStorage.removeItem(chatStorageKey())
}

// Chat history survives a page refresh, but goes stale fast — after an hour
// it's restored as a blank conversation instead of confusing leftover context.
const CHAT_TTL_MS = 60 * 60 * 1000

function chatStorageKey() {
  return state.currentUser ? `tracker-chat:${state.currentUser.id}` : null
}

function persistChat() {
  const key = chatStorageKey()
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify({ display: state.chatDisplay, api: state.chatApiMessages, ts: Date.now() }))
  } catch (_) { /* storage full/unavailable — chat just won't survive a refresh */ }
}

// Call once on initial app load (not on every auth event — a token refresh
// firing mid-conversation must not clobber the in-memory chat with the
// older persisted snapshot from before this session's messages).
export function restoreChatIfFresh() {
  const key = chatStorageKey()
  if (!key) return
  let saved
  try { saved = JSON.parse(localStorage.getItem(key) || 'null') } catch (_) { return }
  if (!saved) return
  if (Date.now() - saved.ts > CHAT_TTL_MS) { localStorage.removeItem(key); return }

  state.chatDisplay = (saved.display || []).filter(m => !m.thinking)
  state.chatApiMessages = saved.api || []
  renderChat()
  if (state.chatDisplay.length) setChatPanelState('peek')
}

async function executeTool(name, input) {
  const date = input.date || dateStr()
  try {
    if (name === 'lookup_food') return JSON.stringify(await searchFoodDatabase(input.query))
    if (name === 'calculate') {
      try { return String(safeCalc(input.expression)) } catch (e) { return 'error: invalid expression' }
    }
    if (name === 'log_food') {
      await db.addFood(date, { description: input.description, calories: input.calories||0, protein: input.protein||0, carbs: input.carbs||0, fat: input.fat||0, meal: input.meal||'snack' })
      db.bust()
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
      db.bust()
      return 'updated'
    }
    if (name === 'delete_food')   { await db.deleteFood(input.id); db.bust(); return 'deleted' }
    if (name === 'log_workout') {
      await db.addWorkout(date, { description: input.description, intensity: input.intensity,
        calories_burned: input.calories_burned||null, duration_min: input.duration_min||null,
        distance_km: input.distance_km||null, heart_rate_avg: input.heart_rate_avg||null,
        time: nowTime() })
      db.bust()
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
      db.bust()
      return 'updated'
    }
    if (name === 'delete_workout') { await db.deleteWorkout(input.id); db.bust(); return 'deleted' }
    if (name === 'log_weight')     { await db.upsertWeight({ kg: input.kg, date }); db.bust(); return `logged for ${date}` }
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
      await db.saveSettings({ cal_rest: TARGETS.calories.rest, cal_training: TARGETS.calories.training, protein_g: TARGETS.protein, carbs_g: TARGETS.carbs, fat_g: TARGETS.fat })
      return 'targets updated'
    }
    return `unknown tool: ${name}`
  } catch (e) { return `error: ${e.message}` }
}

export async function sendChatMessage(text, renderActiveFn, images = []) {
  text = text.trim()
  if (!text && !images.length) return

  const displayText = text || '(image)'
  state.chatDisplay.push({ role: 'user', text: displayText, imageCount: images.length || undefined })

  let apiContent
  if (images.length) {
    apiContent = [
      ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
      { type: 'text', text: text || 'What do you see in this image?' },
    ]
  } else {
    apiContent = text
  }
  state.chatApiMessages.push({ role: 'user', content: apiContent })
  state.chatDisplay.push({ role: 'assistant', text: thinkingVerb() + '…', thinking: true })
  renderChat()

  _abortController = new AbortController()
  const signal = _abortController.signal

  if (isDemo) {
    try {
      const delayMs = 600 + Math.random() * 2400
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, delayMs)
        signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
      })
      state.chatDisplay.pop()
      state.chatDisplay.push({ role: 'assistant', text: DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)] })
    } catch (e) {
      state.chatDisplay.pop()
      if (e.name !== 'AbortError') state.chatDisplay.push({ role: 'assistant', text: '❌ ' + e.message })
    } finally {
      _abortController = null
    }
    renderChat()
    persistChat()
    if (renderActiveFn) await renderActiveFn()
    return
  }

  try {
    const system = await buildClaudeSystem()
    let replyText = ''
    let currentMessages = state.chatApiMessages

    // Hard cap on lookup_food calls per message, independent of whether Claude
    // follows the "don't retry with reworded queries" prompt rule — a model
    // that ignores it should still fail closed instead of hammering both APIs.
    let lookupCount = 0
    const LOOKUP_CAP = 6

    for (let round = 0; round < 5; round++) {
      const msg = await callClaudeApi(currentMessages, system, signal)
      const toolCalls = msg.content.filter(b => b.type === 'tool_use')
      replyText = msg.content.find(b => b.type === 'text')?.text || ''

      if (!toolCalls.length) {
        logClaudeRound(round, msg, [])
        state.chatApiMessages.push({ role: 'assistant', content: msg.content })
        break
      }
      const thinkingMsg = state.chatDisplay[state.chatDisplay.length - 1]
      if (thinkingMsg?.thinking) {
        thinkingMsg.text = statusForToolCalls(toolCalls)
        renderChat()
      }
      const executed = await Promise.all(toolCalls.map(async tc => {
        if (tc.name === 'lookup_food' && ++lookupCount > LOOKUP_CAP) {
          return { tc, content: 'error: lookup limit reached for this message — stop retrying, estimate this item from context instead' }
        }
        return { tc, content: String(await executeTool(tc.name, tc.input)) }
      }))
      logClaudeRound(round, msg, executed)

      // Turn the "thinking" placeholder into a permanent, grouped log line of
      // what was attempted (and whether any of it failed), then queue a fresh
      // placeholder for the next round. Silent tools (e.g. calculate) are
      // logged to console above but never shown in the chat — and if a round
      // was *only* silent tools, reuse the same placeholder instead of
      // pushing a new one, so it doesn't get left behind as an orphaned bubble.
      const visible = executed.filter(({ tc }) => !SILENT_TOOLS.has(tc.name))
      const toolLogIdx = state.chatDisplay.length - 1
      if (state.chatDisplay[toolLogIdx]?.thinking) {
        if (visible.length) {
          state.chatDisplay[toolLogIdx] = { role: 'tool', items: groupToolCalls(visible) }
          state.chatDisplay.push({ role: 'assistant', text: thinkingVerb() + '…', thinking: true })
        } else {
          state.chatDisplay[toolLogIdx].text = thinkingVerb() + '…'
        }
      }
      renderChat()

      const toolResults = executed.map(({ tc, content }) => ({ type: 'tool_result', tool_use_id: tc.id, content }))
      state.chatApiMessages.push({ role: 'assistant', content: msg.content })
      state.chatApiMessages.push({ role: 'user', content: toolResults })
      currentMessages = state.chatApiMessages
    }

    state.chatDisplay.pop()
    if (replyText) state.chatDisplay.push({ role: 'assistant', text: replyText })
  } catch (e) {
    state.chatDisplay.pop()
    if (e.name !== 'AbortError') {
      state.chatDisplay.push({ role: 'assistant', text: '❌ ' + e.message })
    }
  } finally {
    _abortController = null
  }

  renderChat()
  persistChat()
  if (renderActiveFn) await renderActiveFn()
}

export function openChat(initialText, renderActiveFn, images = []) {
  const key = localStorage.getItem('tracker-anthropic-key') || ''
  if (!key && !isDemo) { openSheet('apikey-sheet'); return Promise.resolve() }
  if (initialText || images.length) {
    setChatPanelState('peek')
    return sendChatMessage(initialText, renderActiveFn, images)
  }
  return Promise.resolve()
}

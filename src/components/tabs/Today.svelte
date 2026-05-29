<script>
  import { dataGen, activeTab, currentUser, statsOpen, wisdomReloadToken } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { TARGETS, MEAL_ORDER, getCalorieGoal } from '../../lib/config.js'
  import { dateStr, sumFood, calculateNetActiveCalories, fmtDateShort } from '../../lib/utils.js'
  import { stagger } from '../../lib/animate.js'
  import { calRingHTML, macroRingHTML, weekChartHTML, streakHTML, sparklineHTML, MACRO_COLORS } from '../../lib/charts.js'
  import { foodItem, workoutItem, groupWorkoutsByConflict, workoutStack } from '../../lib/renderers.js'
  import { fetchDailyWisdom } from '../../lib/ai.js'
  import { materialIcon } from '../../lib/icons.js'

  const MEAL_TIME_ORDER = ['breakfast', 'lunch', 'snack', 'dinner']
  const MEAL_POS = { breakfast: 0.133, lunch: 0.4, snack: 0.6, dinner: 0.867 }

  let calHtml = ''
  let macroHtml = ''
  let weekHtml = ''
  let streakHtml = ''
  let logsHtml = ''
  let wisdomHtml = ''

  let loadKey = ''
  let wisdomLoadKey = ''

  $: if ($activeTab === 'today') {
    const key = String($dataGen)
    if (key !== loadKey) {
      loadKey = key
      loadData()
      const userId = $currentUser?.id ?? ''
      if (userId && userId !== wisdomLoadKey) {
        wisdomLoadKey = userId
        loadWisdom()
      }
    }
  }

  $: if ($wisdomReloadToken > 0) loadWisdom()

  async function loadData() {
    if (!$currentUser) { calHtml = macroHtml = weekHtml = streakHtml = logsHtml = ''; return }
    const data = await db.load()
    const today = dateStr()
    const food = data.food[today] || []
    const workouts = data.workouts[today] || []
    const totals = sumFood(food)
    const calTarget = getCalorieGoal()
    const maintenanceTarget = TARGETS.calories.rest
    const burnedToday = calculateNetActiveCalories(workouts, TARGETS.calories.bmr)

    calHtml =
      calRingHTML(totals.calories, calTarget, burnedToday, computeMealFrac(data, calTarget)) +
      `<div class="cal-badges">
        <span class="badge">Maintenance: ${maintenanceTarget.toLocaleString()} kcal</span>
        <span class="badge">Goal: ${calTarget.toLocaleString()} kcal${TARGETS.calories.deficit ? ' (-' + TARGETS.calories.deficit + ')' : ''}</span>
        ${burnedToday > 0 ? `<span class="badge">Activity: +${burnedToday} kcal</span>` : ''}
      </div>`

    macroHtml =
      macroRingHTML('Protein', totals.protein, TARGETS.protein, 'g', MACRO_COLORS.protein) +
      macroRingHTML('Carbs',   totals.carbs,   TARGETS.carbs,   'g', MACRO_COLORS.carbs) +
      macroRingHTML('Fat',     totals.fat,     TARGETS.fat,     'g', MACRO_COLORS.fat)

    weekHtml   = weekChartHTML(data)
    streakHtml = streakHTML(data)

    const orderedFood = food
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const mA = MEAL_ORDER.indexOf(a.entry.meal || 'snack')
        const mB = MEAL_ORDER.indexOf(b.entry.meal || 'snack')
        return (mA - mB) || (a.index - b.index)
      })
      .map(({ entry }) => entry)

    logsHtml = `
      <div class="section-label">Food</div>
      ${stagger(orderedFood, e => foodItem(e, today))}
      <button class="log-add-btn" data-action="open-food-sheet" data-meal="snack">+ Add meal</button>
      <div class="section-label" style="margin-top:14px">Activities</div>
      ${stagger(groupWorkoutsByConflict(workouts), item =>
        item.type === 'stack' ? workoutStack(item.entries, today) : workoutItem(item.entry, today)
      )}
      <button class="log-add-btn" data-action="open-workout-sheet">+ Add activity</button>
      <div class="section-label" style="margin-top:14px">Weight</div>
      ${renderWeightSection(data.weights || [], today)}
    `
  }

  async function loadWisdom() {
    if (!$currentUser) { wisdomHtml = ''; return }
    wisdomHtml = wisdomHeader() + '<div class="wisdom-text wisdom-loading">Loading...</div>'
    const text = await fetchDailyWisdom()
    wisdomHtml = text ? wisdomHeader() + `<div class="wisdom-text">${text}</div>` : ''
  }

  function wisdomHeader() {
    return `<div class="wisdom-header"><div class="wisdom-title">Claude Wisdom</div><button class="wisdom-reload-btn" data-action="reload-wisdom" aria-label="Regenerate"><span class="material-symbols-outlined" style="font-size:14px">refresh</span></button></div>`
  }

  function timeOfDayFrac() {
    const EATING_START = 7, EATING_END = 22
    const now = new Date()
    const t = now.getHours() + now.getMinutes() / 60
    if (t <= EATING_START) return 0
    if (t >= EATING_END) return 1
    return (t - EATING_START) / (EATING_END - EATING_START)
  }

  function computeMealFrac(data, effectiveTarget) {
    const t = timeOfDayFrac()
    if (t <= 0) return 0
    const sums     = Object.fromEntries(MEAL_TIME_ORDER.map(m => [m, 0]))
    const daysSeen = Object.fromEntries(MEAL_TIME_ORDER.map(m => [m, 0]))
    for (let i = 1; i <= 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dayMealCals = {}
      for (const e of (data.food[dateStr(d)] || [])) {
        if (e.meal && e.meal in sums) dayMealCals[e.meal] = (dayMealCals[e.meal] || 0) + (e.calories || 0)
      }
      for (const m of MEAL_TIME_ORDER) {
        if (m in dayMealCals) { sums[m] += dayMealCals[m]; daysSeen[m]++ }
      }
    }
    const totalDays = Object.values(daysSeen).reduce((s, c) => s + c, 0)
    if (totalDays === 0 || effectiveTarget <= 0) return t
    const knownAvgs = MEAL_TIME_ORDER.map(m => daysSeen[m] > 0 ? sums[m] / daysSeen[m] : null)
    const knownVals = knownAvgs.filter(v => v !== null)
    const fallback  = knownVals.length > 0 ? knownVals.reduce((s, v) => s + v, 0) / knownVals.length : 0
    const avgs      = Object.fromEntries(MEAL_TIME_ORDER.map((m, i) => [m, knownAvgs[i] ?? fallback]))
    let expected = 0
    for (let i = 0; i < MEAL_TIME_ORDER.length; i++) {
      const m       = MEAL_TIME_ORDER[i]
      const pos     = MEAL_POS[m]
      const prevPos = i > 0 ? MEAL_POS[MEAL_TIME_ORDER[i - 1]] : 0
      if (t >= pos)          expected += avgs[m]
      else if (t > prevPos)  expected += avgs[m] * (t - prevPos) / (pos - prevPos)
    }
    return expected / effectiveTarget
  }

  function renderWeightSection(weights, today) {
    const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date))
    const todayEntry = sorted.find(w => w.date === today)
    if (!todayEntry) return `<button class="log-add-btn" data-action="log-weight">+ Log today's weight</button>`
    const prev = sorted.find(w => w.date < today)
    const delta = prev ? todayEntry.kg - prev.kg : null
    let dHtml = ''
    if (delta !== null) {
      const cls = delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'same'
      dHtml = `<span class="delta ${cls}">${delta > 0 ? '+' : ''}${delta.toFixed(2)} kg</span>`
    }
    return `
      <button class="log-add-btn" style="margin-bottom:12px" data-action="log-weight">+ Log today's weight</button>
      ${sparklineHTML(sorted, { compact: false })}
      <div class="weight-entry">
        <div class="weight-entry-date">${fmtDateShort(todayEntry.date)}</div>
        <div class="weight-entry-right">
          ${dHtml}
          <div class="weight-entry-kg">${todayEntry.kg.toFixed(2)}<span style="font-size:12px;font-weight:400;color:var(--tx3)"> kg</span></div>
        </div>
        <div class="entry-menu-wrap">
          <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
          <div class="entry-menu">
            <button data-action="edit-weight" data-date="${todayEntry.date}">Edit</button>
            <button class="danger" data-action="delete-weight" data-date="${todayEntry.date}">Delete</button>
          </div>
        </div>
      </div>`
  }

  function toggleStats() {
    statsOpen.update(v => !v)
  }
</script>

<div class="today-inner">
  <div class="today-left">
    <div class="cal-section">{@html calHtml}</div>
    <div class="macro-rings">{@html macroHtml}</div>
    <button class="stats-toggle" on:click={toggleStats}>
      <span>{$statsOpen ? 'Hide stats' : 'Stats'}</span>
      <span class="material-symbols-outlined" style="font-size:16px">{$statsOpen ? 'expand_less' : 'expand_more'}</span>
    </button>
    <div class="stats-section" style={$statsOpen ? '' : 'display:none'}>
      <div class="chart-card">{@html weekHtml}</div>
      <div class="streak-card">{@html streakHtml}</div>
    </div>
    <div class="wisdom-card">{@html wisdomHtml}</div>
  </div>
  <div class="today-right">{@html logsHtml}</div>
</div>

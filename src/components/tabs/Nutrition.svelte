<script>
  import { dataGen, activeTab, currentUser, heatmapMonthOffset } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { dateStr, fmtDateShort, fmt, round, sumFood } from '../../lib/utils.js'
  import { stagger } from '../../lib/animate.js'
  import { calTrendHTML, mealMacroAvgHTML, sparklineHTML, monthHeatmapHTML, monthNavHTML } from '../../lib/charts.js'
  import { foodItem } from '../../lib/renderers.js'
  import { materialIcon } from '../../lib/icons.js'

  let html = ''
  let loadKey = ''

  $: if ($activeTab === 'nutrition') {
    const key = `${$dataGen}-${$heatmapMonthOffset}`
    if (key !== loadKey) { loadKey = key; loadData($heatmapMonthOffset) }
  }

  async function loadData(monthOffset) {
    if (!$currentUser) { html = ''; return }
    const data = await db.load()
    const today = dateStr()

    const ref = new Date()
    ref.setDate(1)
    ref.setMonth(ref.getMonth() + monthOffset)
    const year = ref.getFullYear()
    const month = ref.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const feedDays = []
    for (let day = daysInMonth; day >= 1; day--) {
      const d = new Date(year, month, day)
      const ds = dateStr(d)
      const food = data.food[ds] || []
      const isToday = ds === today
      if (food.length > 0 || isToday) feedDays.push({ ds, food, isToday, d })
    }

    const feedHTML = stagger(feedDays, ({ ds, food, isToday, d }) => {
      const label = isToday
        ? 'Today'
        : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      const totals = sumFood(food)
      const macroSummary = food.length > 0
        ? `<span class="nutrition-day-macro">${round(totals.calories)} kcal · P${fmt(totals.protein)}g · C${fmt(totals.carbs)}g · F${fmt(totals.fat)}g</span>`
        : ''
      return `
        <div class="workout-day-group" data-date="${ds}">
          <div class="workout-day-hd${isToday ? ' today-hd' : ''}">${label} ${macroSummary}</div>
          ${food.map(e => foodItem(e, ds)).join('')}
        </div>`
    }, 0.06)

    const foodDays = Object.keys(data.food || {}).filter(ds => {
      const [y, m] = ds.split('-').map(Number)
      return y === year && m === month + 1 && (data.food[ds] || []).length > 0
    }).length

    html = `
      <div class="panel-inner">
        <div class="panel-left">
          ${monthNavHTML(monthOffset)}
          <div class="chart-card">
            <div class="chart-header">
              <span class="chart-title">Nutrition</span>
              <span class="chart-sub">${foodDays} day${foodDays !== 1 ? 's' : ''} logged</span>
            </div>
            ${monthHeatmapHTML(data, monthOffset, 'nutrition')}
          </div>
          <button class="stats-toggle" data-action="panel-stats-toggle">
            <span class="panel-toggle-label">Stats</span>
            <span class="material-symbols-outlined panel-toggle-arrow" style="font-size:16px">expand_more</span>
          </button>
          <div class="stats-section" style="display:none">
            <div class="section-label">Last 30 days</div>
            <div class="chart-card">
              ${calTrendHTML(data, 30, { title: 'Caloric intake', primary: 'input' })}
            </div>
            <div class="chart-card">
              ${mealMacroAvgHTML(data, 30)}
            </div>
          </div>
          <div class="section-label">Weight</div>
          ${renderWeightSection(data)}
        </div>
        <div class="panel-right">
          <button class="log-add-btn" style="margin-bottom:16px" data-action="open-food-sheet">+ Log food</button>
          ${feedHTML || '<div class="empty">No food logged this month.</div>'}
        </div>
      </div>`
  }

  function renderWeightSection(data) {
    const weights = [...(data.weights || [])].sort((a, b) => b.date.localeCompare(a.date))
    if (!weights.length) return `<button class="log-add-btn" data-action="log-weight">+ Log today's weight</button>`

    const entries = weights.slice(0, 3).map((w, i) => {
      const prev = weights[i + 1]
      const delta = prev ? w.kg - prev.kg : null
      let dHtml = ''
      if (delta !== null) {
        const cls = delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'same'
        dHtml = `<span class="delta ${cls}">${delta > 0 ? '+' : ''}${delta.toFixed(2)} kg</span>`
      }
      return `
        <div class="weight-entry">
          <div class="weight-entry-date">${fmtDateShort(w.date)}</div>
          <div class="weight-entry-right">
            ${dHtml}
            <div class="weight-entry-kg">${w.kg.toFixed(2)}<span style="font-size:12px;font-weight:400;color:var(--tx3)"> kg</span></div>
          </div>
          <div class="entry-menu-wrap">
            <button class="entry-menu-btn" data-action="toggle-menu">${materialIcon('more_vert', 16)}</button>
            <div class="entry-menu">
              <button data-action="edit-weight" data-date="${w.date}">Edit</button>
              <button class="danger" data-action="delete-weight" data-date="${w.date}">Delete</button>
            </div>
          </div>
        </div>`
    }).join('')

    return `
      <button class="log-add-btn" style="margin-bottom:12px" data-action="log-weight">+ Log today's weight</button>
      ${sparklineHTML(weights, { compact: true })}
      ${entries}
      ${weights.length > 3 ? `<div class="empty" style="padding:8px 0">${weights.length - 3} older entries not shown</div>` : ''}`
  }
</script>

{@html html}

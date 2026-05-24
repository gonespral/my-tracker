import { state } from '../state.js'
import { db } from '../db.js'
import { TARGETS } from '../config.js'
import { dateStr, fmtDateShort, fmt, round, sumFood, calculateNetActiveCalories } from '../utils.js'
import { monthNavHTML, monthHeatmapHTML, sparklineHTML } from '../charts.js'
import { foodByMeal } from '../renderers.js'
import { materialIcon } from '../icons.js'

function renderWeightSection(data) {
  const weights = [...(data.weights || [])].sort((a, b) => b.date.localeCompare(a.date))
  if (!weights.length) {
    return `<button class="log-add-btn" data-action="log-weight">+ Log today's weight</button>`
  }

  const entries = weights.slice(0, 10).map((w, i) => {
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
    ${sparklineHTML(weights)}
    ${entries}
    ${weights.length > 10 ? `<div class="empty" style="padding:8px 0">${weights.length - 10} older entries not shown</div>` : ''}`
}

export async function renderNutrition(monthOffset) {
  const panel = document.getElementById('panel-nutrition')
  if (!state.currentUser) { panel.innerHTML = ''; return }

  if (monthOffset === undefined) monthOffset = state.heatmapMonthOffset || 0

  const data = await db.load()
  const today = dateStr()

  const ref = new Date()
  ref.setDate(1)
  ref.setMonth(ref.getMonth() + monthOffset)
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const monthLabel = ref.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthDays = []
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    const workouts = data.workouts[ds] || []
    const input = sumFood(food).calories
    const burned = calculateNetActiveCalories(workouts, TARGETS.calories.bmr)
    const baseTarget = TARGETS.calories.rest
    const target = baseTarget + burned
    const diff = input - target
    monthDays.push({ ds, d, food, input, burned, baseTarget, target, diff, isToday: ds === today })
  }

  const loggedDays = monthDays.filter(day => day.food.length > 0).length
  const onTrackDays = monthDays.filter(day => Math.abs(day.diff) <= Math.max(50, day.target * 0.3)).length

  const feedDays = monthDays.filter(day => day.food.length > 0).reverse()
  const feedHTML = feedDays.map(({ ds, food, isToday, d }) => {
    const label = isToday
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const totals = sumFood(food)
    const macroSummary = `<span class="nutrition-day-macro">${round(totals.calories)} kcal · P${fmt(totals.protein)}g · C${fmt(totals.carbs)}g · F${fmt(totals.fat)}g</span>`
    return `
      <div class="workout-day-group">
        <div class="workout-day-hd${isToday ? ' today-hd' : ''}">${label} ${macroSummary}</div>
        ${foodByMeal(food, ds)}
      </div>`
  }).join('')

  panel.innerHTML = `
    <div class="panel-inner">
      <div class="panel-left">
        ${monthNavHTML(monthOffset)}
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">Nutrition calendar</span>
            <span class="chart-sub">${loggedDays} logged days · ${onTrackDays} days within 30% of target</span>
          </div>
          ${monthHeatmapHTML(data, monthOffset, 'nutrition')}
        </div>
        <div class="section-divider"></div>
        <div class="section-label">Weight</div>
        ${renderWeightSection(data)}
      </div>
      <div class="panel-right">
        <button class="log-add-btn" style="margin-bottom:16px" data-action="open-food-sheet">+ Log food</button>
        ${feedHTML || '<div class="empty">No food logged this month.</div>'}
      </div>
    </div>`
}

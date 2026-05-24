import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr, fmtDateShort, fmt, round, sumFood } from '../utils.js'
import { calTrendHTML, macroAvgBarsHTML, sparklineHTML } from '../charts.js'
import { foodByMeal } from '../renderers.js'
import { materialIcon } from '../icons.js'


function renderWeightSection(data) {
  const weights = [...(data.weights || [])].sort((a, b) => b.date.localeCompare(a.date))
  if (!weights.length) {
    return `<button class="log-add-btn" data-action="log-weight">+ Log today's weight</button>`
  }
  const latest = weights[0]
  const entries = weights.slice(0, 10).map((w, i) => {
    const prev  = weights[i + 1]
    const delta = prev ? w.kg - prev.kg : null
    let dHtml = ''
    if (delta !== null) {
      const cls = delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'same'
      dHtml = `<span class="delta ${cls}">${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg</span>`
    }
    return `
      <div class="weight-entry">
        <div class="weight-entry-date">${fmtDateShort(w.date)}</div>
        <div class="weight-entry-right">
          ${dHtml}
          <div class="weight-entry-kg">${w.kg.toFixed(1)}<span style="font-size:12px;font-weight:400;color:var(--tx3)"> kg</span></div>
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
    <div class="weight-hero">
      <div class="weight-big">${latest.kg.toFixed(1)}</div>
      <div class="weight-kg-unit">kg</div>
      <div class="weight-sub">Last logged ${fmtDateShort(latest.date)}</div>
    </div>
    ${sparklineHTML(weights)}
    <div class="section-label">Weight history</div>
    ${entries}
    ${weights.length > 10 ? `<div class="empty" style="padding:8px 0">${weights.length - 10} older entries not shown</div>` : ''}`
}

export async function renderNutrition() {
  const panel = document.getElementById('panel-nutrition')

  if (!state.currentUser) { panel.innerHTML = ''; return }

  const data  = await db.load()
  const today = dateStr()

  // Today + last 30 days with food entries
  const feedDays = []
  for (let i = 0; i <= 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    if (i === 0 || food.length > 0) feedDays.push({ ds, food, isToday: ds === today, d })
  }

  const feedHTML = feedDays.map(({ ds, food, isToday, d }) => {
    const label = isToday
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const totals = sumFood(food)
    const macroSummary = food.length
      ? `<span class="nutrition-day-macro">${round(totals.calories)} kcal · P${fmt(totals.protein)}g · C${fmt(totals.carbs)}g · F${fmt(totals.fat)}g</span>`
      : ''
    return `
      <div class="workout-day-group">
        <div class="workout-day-hd${isToday ? ' today-hd' : ''}">${label} ${macroSummary}</div>
        ${food.length ? foodByMeal(food, ds) : ''}
        <button class="log-add-btn" data-action="open-food-sheet" data-meal="snack" data-date="${ds}">
          + Add food${isToday ? '' : ' for this date'}
        </button>
      </div>`
  }).join('')

  panel.innerHTML = `
    <div class="panel-inner">
      <div class="panel-left">
        <div class="chart-card">${calTrendHTML(data, 30, { title: 'Caloric input', primary: 'input' })}</div>
        <div class="section-label">Macros (30-day avg)</div>
        <div class="chart-card">${macroAvgBarsHTML(data, 30)}</div>
        <div class="section-label" style="margin-top:8px">Weight</div>
        ${renderWeightSection(data)}
      </div>
      <div class="panel-right">
        <div class="section-label" style="margin-top:4px">Food log</div>
        ${feedHTML || '<div class="empty">No food logged yet.</div>'}
      </div>
    </div>`
}

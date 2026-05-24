import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr, fmtDateShort, fmt, round, sumFood } from '../utils.js'
import { calTrendHTML, macroAvgBarsHTML, sparklineHTML } from '../charts.js'
import { foodByMeal } from '../renderers.js'

const SIGNIN_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.57C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`

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
          <button class="entry-menu-btn" data-action="toggle-menu">⋮</button>
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

  if (!state.currentUser) {
    panel.innerHTML = `
      <div class="panel-scroll" style="display:flex;align-items:center;justify-content:center">
        <div class="signin-prompt">
          <div class="signin-icon">🚴</div>
          <div class="signin-title">MyTracker</div>
          <div class="signin-sub">Sign in to load your data</div>
          <button class="github-signin-btn" data-action="signin">
            ${SIGNIN_SVG}
            Sign in with GitHub
          </button>
        </div>
      </div>`
    return
  }

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
    <div class="panel-scroll">
      <div class="section-label" style="margin-top:4px">Calories (30 days)</div>
      <div class="chart-card">${calTrendHTML(data, 30)}</div>
      <div class="section-label">Macros (30-day avg)</div>
      <div class="chart-card">${macroAvgBarsHTML(data, 30)}</div>
      <div class="section-label" style="margin-top:8px">Weight</div>
      ${renderWeightSection(data)}
      <div class="section-label" style="margin-top:20px">Food log</div>
      ${feedHTML || '<div class="empty">No food logged yet.</div>'}
    </div>`
}

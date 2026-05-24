import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr } from '../utils.js'
import { calTrendHTML, streakHTML, monthHeatmapHTML, activityStatsHTML, activityTypeBreakdownHTML } from '../charts.js'
import { workoutItem } from '../renderers.js'


export async function renderWorkouts(monthOffset) {
  const panel = document.getElementById('panel-workouts')
  if (monthOffset === undefined) monthOffset = state.heatmapMonthOffset || 0

  if (!state.currentUser) { panel.innerHTML = ''; return }

  const data  = await db.load()
  const today = dateStr()

  // Determine the month window from monthOffset
  const ref = new Date()
  ref.setDate(1)
  ref.setMonth(ref.getMonth() + monthOffset)
  const year  = ref.getFullYear()
  const month = ref.getMonth() // 0-based
  // All days in the selected month that have workouts, plus today if current month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const feedDays = []
  for (let day = daysInMonth; day >= 1; day--) {
    const d  = new Date(year, month, day)
    const ds = dateStr(d)
    const ws = data.workouts[ds] || []
    const isToday = ds === today
    if (isToday || ws.length > 0) feedDays.push({ ds, ws, isToday, d })
  }

  const feedHTML = feedDays.map(({ ds, ws, isToday, d }) => {
    const label = isToday
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    return `
      <div class="workout-day-group" data-date="${ds}">
        <div class="workout-day-hd${isToday ? ' today-hd' : ''}">${label}</div>
        ${ws.map(e => workoutItem(e, ds)).join('')}
        <button class="log-add-btn" data-action="open-workout-sheet" data-date="${ds}">
          + Add activity${isToday ? '' : ' for this date'}
        </button>
      </div>`
  }).join('')

  panel.innerHTML = `
    <div class="panel-inner">
      <div class="panel-left">
        <div class="chart-card">${calTrendHTML(data, 30, { title: 'Calorie burn', primary: 'burned' })}</div>
        <div class="chart-card">${monthHeatmapHTML(data, monthOffset)}</div>
        <div class="chart-card">${activityTypeBreakdownHTML(data, year, month)}</div>
        <div class="section-divider"></div>
        <div class="section-label">Streak</div>
        <div class="streak-card">${streakHTML(data)}</div>
        <div class="section-label">Last 30 days</div>
        <div class="chart-card">${activityStatsHTML(data, 30)}</div>
      </div>
      <div class="panel-right">
        ${feedHTML || '<div class="empty">No activities this month.</div>'}
      </div>
    </div>`
}

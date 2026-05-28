import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr } from '../utils.js'
import { stagger, renderPanel } from '../animate.js'
import { calTrendHTML, streakHTML, monthHeatmapHTML, monthNavHTML, activityStatsHTML, activityTypeBreakdownHTML } from '../charts.js'
import { workoutItem, groupWorkoutsByConflict, workoutStack } from '../renderers.js'


export async function renderWorkouts(monthOffset) {
  const panel = document.getElementById('panel-workouts')
  if (monthOffset === undefined) monthOffset = state.heatmapMonthOffset || 0

  if (!state.currentUser) { panel.innerHTML = ''; return }

  const data = await db.load()
  const today = dateStr()

  // Determine the month window from monthOffset
  const ref = new Date()
  ref.setDate(1)
  ref.setMonth(ref.getMonth() + monthOffset)
  const year = ref.getFullYear()
  const month = ref.getMonth() // 0-based
  // All days in the selected month that have workouts, plus today if current month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const feedDays = []
  for (let day = daysInMonth; day >= 1; day--) {
    const d = new Date(year, month, day)
    const ds = dateStr(d)
    const ws = data.workouts[ds] || []
    const isToday = ds === today
    if (isToday || ws.length > 0) feedDays.push({ ds, ws, isToday, d })
  }

  const feedHTML = stagger(feedDays, ({ ds, ws, isToday, d }) => {
    const label = isToday
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    return `
      <div class="workout-day-group" data-date="${ds}">
        <div class="workout-day-hd${isToday ? ' today-hd' : ''}">${label}</div>
        ${groupWorkoutsByConflict(ws).map(item =>
          item.type === 'stack' ? workoutStack(item.entries, ds) : workoutItem(item.entry, ds)
        ).join('')}
      </div>`
  }, 0.06)

  const workoutDays = Object.keys(data.workouts || {}).filter(ds => {
    const [y, m] = ds.split('-').map(Number)
    return y === year && m === month + 1 && (data.workouts[ds] || []).some(w => !w.isDuplicate)
  }).length

  renderPanel(panel, `
    <div class="panel-inner">
      <div class="panel-left">
        ${monthNavHTML(monthOffset)}
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">Activities</span>
            <span class="chart-sub">${workoutDays} total</span>
          </div>
          ${monthHeatmapHTML(data, monthOffset, 'workouts')}
        </div>
        <button class="stats-toggle" data-action="panel-stats-toggle">
          <span class="panel-toggle-label">Stats</span>
          <span class="material-symbols-outlined panel-toggle-arrow" style="font-size:16px">expand_more</span>
        </button>
        <div class="stats-section" style="display:none">
          <div class="chart-card">${activityTypeBreakdownHTML(data, year, month)}</div>
          <div class="streak-card">${streakHTML(data)}</div>
          <div class="section-divider"></div>
          <div class="section-label">Last 30 days</div>
          <div class="chart-card">${activityStatsHTML(data, 30)}</div>
          <div class="chart-card" style="margin-top:12px">${calTrendHTML(data, 30, { title: 'Calorie burn', primary: 'burned' })}</div>
        </div>
      </div>
      <div class="panel-right">
        <button class="log-add-btn" style="margin-bottom:16px" data-action="open-workout-sheet">+ Log activity</button>
        ${feedHTML || '<div class="empty">No activities this month.</div>'}
      </div>
    </div>`)
}

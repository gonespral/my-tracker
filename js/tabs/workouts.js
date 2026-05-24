import { state } from '../state.js'
import { db } from '../db.js'
import { dateStr } from '../utils.js'
import { streakHTML, monthHeatmapHTML, activityStatsHTML, activityTypeBreakdownHTML } from '../charts.js'
import { workoutItem } from '../renderers.js'

const SIGNIN_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.57C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`

export async function renderWorkouts(monthOffset) {
  const panel = document.getElementById('panel-workouts')
  if (monthOffset === undefined) monthOffset = state.heatmapMonthOffset || 0

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

  // Today + past 30 days that have workouts
  const feedDays = []
  for (let i = 0; i <= 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const ws = data.workouts[ds] || []
    if (i === 0 || ws.length > 0) feedDays.push({ ds, ws, isToday: ds === today, d })
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
    <div class="panel-scroll">
      <div class="section-label" style="margin-top:4px">Streak</div>
      <div class="streak-card">${streakHTML(data)}</div>
      <div class="section-label">This month</div>
      <div class="chart-card">${monthHeatmapHTML(data, monthOffset)}</div>
      <div class="section-label">Last 30 days</div>
      <div class="chart-card">${activityStatsHTML(data, 30)}</div>
      <div class="section-label">Activity mix</div>
      <div class="chart-card">${activityTypeBreakdownHTML(data, 30)}</div>
      <div class="section-label" style="margin-top:8px" id="activities-feed-label">Recent</div>
      ${feedHTML || '<div class="empty">No activities logged yet.</div>'}
    </div>`
}

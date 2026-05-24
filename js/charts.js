import { TARGETS, ACTIVITY_TYPE, detectActivityType } from './config.js'
import { dateStr, sumFood, fmt, round } from './utils.js'

export function calRingHTML(consumed, target, burned = 0) {
  const effectiveTarget = target + burned
  const size = 160, sw = 12, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(consumed / effectiveTarget, 1)
  const off  = circ * (1 - pct)
  const cx = size / 2, cy = size / 2
  const over  = consumed > effectiveTarget
  const close = consumed > effectiveTarget * 0.85
  const color = over ? '#ef4444' : close ? '#f59e0b' : 'var(--accent)'
  const rem   = effectiveTarget - consumed

  // Inner ring for burned calories
  const ri = r - sw - 3, swi = 5
  const circi = 2 * Math.PI * ri
  const burnPct = burned > 0 ? Math.min(burned / effectiveTarget, 1) : 0
  const burnOff = circi * (1 - burnPct)

  return `
    <div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
          stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          style="transition:stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)"/>
        ${burned > 0 ? `
        <circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="var(--track)" stroke-width="${swi}" opacity="0.7"/>
        <circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="#f97316" stroke-width="${swi}"
          stroke-dasharray="${circi.toFixed(2)}" stroke-dashoffset="${burnOff.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          style="transition:stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)"/>` : ''}
      </svg>
      <div class="ring-center">
        <div class="ring-big-num">${round(consumed).toLocaleString()}</div>
        <div class="ring-unit">kcal</div>
        <div class="ring-remaining ${over?'over':''}">
          ${rem >= 0 ? round(rem).toLocaleString()+' left' : round(-rem).toLocaleString()+' over'}
        </div>
        ${burned > 0 ? `<div class="ring-burned">🔥 +${round(burned)}</div>` : ''}
      </div>
    </div>`
}

export function macroRingHTML(label, value, target, unit, accentColor) {
  const size = 72, sw = 7, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(value / target, 1)
  const off  = circ * (1 - pct)
  const cx = size / 2, cy = size / 2
  const over  = value > target
  const close = value > target * 0.85
  const color = over ? '#ef4444' : close ? '#f59e0b' : accentColor

  return `
    <div class="macro-ring-card">
      <div class="macro-ring-label">${label}</div>
      <div class="ring-wrap" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
            style="transition:stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)"/>
        </svg>
        <div class="ring-center">
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;color:var(--tx);line-height:1">
            ${fmt(value)}
          </div>
          <div style="font-size:9px;color:var(--tx3);margin-top:1px">${unit}</div>
        </div>
      </div>
      <div class="macro-ring-target">/ ${target}${unit}</div>
    </div>`
}

export function weekChartHTML(data) {
  const W = 320, H = 120, PL = 30, PR = 8, PT = 14, PB = 24
  const cW = W - PL - PR, cH = H - PT - PB
  const today = dateStr()

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const food     = data.food[ds]     || []
    const workouts = data.workouts[ds] || []
    days.push({
      ds, isToday: ds === today,
      cals: sumFood(food).calories,
      target: workouts.length ? TARGETS.calories.training : TARGETS.calories.rest,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    })
  }

  const maxCal = Math.max(...days.map(d => d.cals), TARGETS.calories.training * 1.1, 100)
  const restTargetY = PT + (1 - TARGETS.calories.rest / maxCal) * cH
  const bW = cW / 7 * 0.6
  const bStep = cW / 7

  const bars = days.map((d, i) => {
    const bH = d.cals > 0 ? Math.max((d.cals / maxCal) * cH, 3) : 0
    const x  = PL + i * bStep + (bStep - bW) / 2
    const y  = PT + cH - bH
    const pct = d.cals / d.target
    const fill = d.isToday
      ? 'var(--accent)'
      : d.cals === 0 ? 'var(--track)'
      : pct > 1.05 ? 'var(--danger)'
      : pct > 0.85 ? 'var(--warn)'
      : 'var(--accent-2)'
    const labelFill = d.isToday ? 'var(--accent)' : 'var(--tx3)'
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}"
        fill="${fill}" rx="4" opacity="${d.isToday ? '1' : '0.75'}"/>
      <text x="${(x+bW/2).toFixed(1)}" y="${(H-6).toFixed(1)}" text-anchor="middle"
        font-size="9" fill="${labelFill}" font-weight="${d.isToday ? '700' : '400'}">${d.label}</text>
      ${d.cals > 0
        ? `<text x="${(x+bW/2).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle"
            font-size="8" fill="${fill}" font-weight="600">${round(d.cals/1000*10)/10}k</text>`
        : ''}`
  }).join('')

  const wkAvg = round(days.reduce((s,d) => s+d.cals, 0) / Math.max(days.filter(d=>d.cals>0).length, 1))
  return `
    <div class="chart-header">
      <span class="chart-title">This week</span>
      <span class="chart-sub">avg ${wkAvg.toLocaleString()} kcal/day</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="week-svg">
      <text x="${PL-4}" y="${(restTargetY+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">${(TARGETS.calories.rest/1000).toFixed(1)}k</text>
      <text x="${PL-4}" y="${(PT+cH+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">0</text>
      <line x1="${PL}" y1="${restTargetY.toFixed(1)}" x2="${(W-PR).toFixed(1)}" y2="${restTargetY.toFixed(1)}"
        stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3"/>
      ${bars}
    </svg>`
}

export function calTrendHTML(data, nDays = 30) {
  const W = 320, H = 100, PL = 30, PR = 8, PT = 10, PB = 20
  const cW = W - PL - PR, cH = H - PT - PB
  const today = dateStr()

  const days = []
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    days.push({ ds, cals: sumFood(data.food[ds] || []).calories, d, isToday: ds === today })
  }

  const maxCal = Math.max(...days.map(d => d.cals), TARGETS.calories.training * 1.1, 100)
  const tY = (v) => PT + (1 - v / maxCal) * cH
  const xStep = cW / (days.length - 1)

  const pts = days.map((day, i) => ({
    x: PL + i * xStep, y: day.cals > 0 ? tY(day.cals) : null, date: day.d,
  }))

  let paths = [], seg = ''
  pts.forEach(p => {
    if (p.y !== null) { seg += (seg ? ' L' : 'M') + `${p.x.toFixed(1)},${p.y.toFixed(1)}` }
    else if (seg)     { paths.push(seg); seg = '' }
  })
  if (seg) paths.push(seg)

  const filled = pts.filter(p => p.y !== null)
  const areaPath = filled.length >= 2
    ? filled.map((p,i) => (i?'L':'M')+`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      + ` L${filled[filled.length-1].x.toFixed(1)},${(PT+cH).toFixed(1)}`
      + ` L${filled[0].x.toFixed(1)},${(PT+cH).toFixed(1)} Z`
    : ''

  const restY = tY(TARGETS.calories.rest)
  const activeDays = days.filter(d => d.cals > 0)
  const avg = activeDays.length ? round(activeDays.reduce((s,d)=>s+d.cals,0)/activeDays.length) : 0
  const todayPt = pts[pts.length - 1]

  const ticks = pts.filter(p => p.date.getDate() === 1 || p.date.getDate() === 15)
  const tickLabels = ticks.map(p =>
    `<text x="${p.x.toFixed(1)}" y="${H}" text-anchor="middle" font-size="8" fill="var(--tx3)">
      ${p.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
    </text>`).join('')

  return `
    <div class="chart-header">
      <span class="chart-title">${nDays}-day calories</span>
      <span class="chart-sub">avg ${avg.toLocaleString()} kcal/day</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="week-svg">
      <defs>
        <linearGradient id="cal-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".18"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity=".01"/>
        </linearGradient>
      </defs>
      <text x="${PL-4}" y="${(restY+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">${(TARGETS.calories.rest/1000).toFixed(1)}k</text>
      <line x1="${PL}" y1="${restY.toFixed(1)}" x2="${(W-PR).toFixed(1)}" y2="${restY.toFixed(1)}"
        stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3"/>
      ${areaPath ? `<path d="${areaPath}" fill="url(#cal-grad)"/>` : ''}
      ${paths.map(p => `<path d="${p}" fill="none" stroke="var(--accent)" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      ${todayPt.y !== null ? `<circle cx="${todayPt.x.toFixed(1)}" cy="${todayPt.y.toFixed(1)}" r="3" fill="var(--accent)"/>` : ''}
      ${tickLabels}
    </svg>`
}

export function macroBarsHTML(totals, label = "Today's macros") {
  const bars = [
    { label: 'Protein', val: totals.protein, target: TARGETS.protein,  unit: 'g', color: 'var(--accent)' },
    { label: 'Carbs',   val: totals.carbs,   target: TARGETS.carbs,    unit: 'g', color: '#3b82f6' },
    { label: 'Fat',     val: totals.fat,      target: TARGETS.fat,      unit: 'g', color: '#f59e0b' },
  ]
  const rows = bars.map(b => {
    const pct   = Math.min((b.val / b.target) * 100, 100).toFixed(1)
    const over  = b.val > b.target
    const color = over ? 'var(--danger)' : b.color
    return `
      <div class="macro-bar-row">
        <div class="macro-bar-label">${b.label}</div>
        <div class="macro-bar-track">
          <div class="macro-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="macro-bar-val" style="color:${color}">${fmt(b.val)}<span class="macro-bar-unit">/${b.target}${b.unit}</span></div>
      </div>`
  }).join('')
  return `<div class="chart-header"><span class="chart-title">${label}</span></div>${rows}`
}

export function macroAvgBarsHTML(data, nDays = 30) {
  const days = []
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const food = data.food[ds] || []
    if (food.length) days.push(sumFood(food))
  }
  if (!days.length) return '<div class="empty">No nutrition data yet.</div>'
  const n = days.length
  const avg = {
    protein: days.reduce((s,d)=>s+d.protein,0)/n,
    carbs:   days.reduce((s,d)=>s+d.carbs,0)/n,
    fat:     days.reduce((s,d)=>s+d.fat,0)/n,
  }
  return macroBarsHTML(avg, `${nDays}-day avg macros`)
}

export function streakHTML(data) {
  const todayStr = dateStr()
  const now = new Date()

  // Monday of the current week
  const dow = now.getDay() // 0=Sun
  const mondayOffset = (dow + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayOffset)

  // Count consecutive active weeks going back from current week
  // A week counts even if only partially elapsed (current week)
  let weekStreak = 0
  for (let w = 0; w < 52; w++) {
    const weekMon = new Date(monday)
    weekMon.setDate(monday.getDate() - w * 7)
    // For current week check only days up to today; past weeks check all 7
    const daysToCheck = w === 0 ? mondayOffset + 1 : 7
    let active = false
    for (let d = 0; d < daysToCheck; d++) {
      const day = new Date(weekMon)
      day.setDate(weekMon.getDate() + d)
      if ((data.workouts[dateStr(day)] || []).length > 0) { active = true; break }
    }
    if (active) weekStreak++
    else break
  }

  // Dots for Mon–Sun of current week
  const dots = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const ds = dateStr(day)
    const isFuture = ds > todayStr
    const isToday  = ds === todayStr
    const has = !isFuture && (data.workouts[ds] || []).length > 0
    const lbl = day.toLocaleDateString('en-US', { weekday: 'narrow' })
    dots.push(`
      <div class="streak-dot-wrap">
        <div class="streak-dot ${has ? 'filled' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}">
          ${has ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>
        <div class="dot-day-label">${lbl}</div>
      </div>`)
  }

  return `
    <div class="streak-number-wrap">
      <div class="streak-number">${weekStreak}</div>
      <div class="streak-label">week streak</div>
    </div>
    <div class="streak-dots">${dots.join('')}</div>`
}

export function sparklineHTML(weights) {
  if (weights.length < 2) return ''
  const ordered = [...weights].reverse()
  const vals = ordered.map(w => w.kg)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = maxV - minV || 0.5
  const W = 400, H = 60, PAD = 8
  const xStep = (W - PAD*2) / (vals.length - 1 || 1)
  const pts = vals.map((v,i) => ({
    x: PAD + i * xStep,
    y: PAD + (1 - (v - minV) / range) * (H - PAD*2),
  }))
  const line = pts.map((p,i) => `${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = line + ` L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`

  return `
    <div class="sparkline-card">
      <div class="chart-header">
        <span class="chart-title">Weight trend</span>
        <span class="chart-sub">${ordered.length} entries · ${minV.toFixed(1)}–${maxV.toFixed(1)} kg</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
        <defs>
          <linearGradient id="wg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity=".18"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity=".02"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#wg)"/>
        <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--accent)"/>`).join('')}
      </svg>
    </div>`
}

export function monthHeatmapHTML(data, monthOffset = 0) {
  const now = new Date()
  now.setDate(1)
  now.setMonth(now.getMonth() + monthOffset)
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = dateStr()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7  // Mon=0

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(`<div class="hm-cell hm-empty"></div>`)
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayWorkouts = data.workouts[ds] || []
    const hasWorkout = dayWorkouts.length > 0
    const isToday = ds === today
    const isFuture = ds > today
    let cls = 'hm-cell'
    if (hasWorkout) cls += ' hm-has'
    if (isToday)    cls += ' hm-today'
    if (isFuture)   cls += ' hm-future'
    if (hasWorkout) {
      const w = dayWorkouts[0]
      const type = w.activity_type || detectActivityType(w.description)
      const emoji = (ACTIVITY_TYPE[type] || ACTIVITY_TYPE.lift).emoji
      cells.push(`<div class="${cls}" data-action="goto-activity-date" data-date="${ds}" style="cursor:pointer">${emoji}</div>`)
    } else {
      cells.push(`<div class="${cls}">${isFuture ? '' : day}</div>`)
    }
  }

  const workoutDays = Object.keys(data.workouts || {}).filter(ds => {
    const [y, m] = ds.split('-').map(Number)
    return y === year && m === month + 1 && (data.workouts[ds] || []).length > 0
  }).length

  const prevOffset = monthOffset - 1
  const nextOffset = monthOffset + 1
  const canGoNext  = monthOffset < 0

  return `
    <div class="chart-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="hm-nav-btn" data-action="heatmap-month" data-offset="${prevOffset}">‹</button>
        <span class="chart-title">${monthName}</span>
        <button type="button" class="hm-nav-btn" data-action="heatmap-month" data-offset="${nextOffset}" ${canGoNext ? '' : 'disabled'}>›</button>
      </div>
      <span class="chart-sub">${workoutDays} activit${workoutDays !== 1 ? 'ies' : 'y'}</span>
    </div>
    <div class="heatmap-dow">${dayLabels.map(l => `<div class="hm-label">${l}</div>`).join('')}</div>
    <div class="heatmap-grid">${cells.join('')}</div>`
}

export function workoutFreqHTML(data, weeks = 8) {
  const W = 320, H = 100, PL = 30, PR = 8, PT = 10, PB = 24
  const cW = W - PL - PR, cH = H - PT - PB

  const buckets = []
  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(); start.setDate(start.getDate() - w * 7 - 6)
    let count = 0
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + d)
      const ds = dateStr(day)
      if ((data.workouts[ds] || []).length > 0) count++
    }
    const label = start.toLocaleDateString('en-US',{month:'short',day:'numeric'})
    buckets.push({ count, label, isCurrent: w === 0 })
  }

  const maxCount = Math.max(...buckets.map(b=>b.count), 3)
  const bW = cW / weeks * 0.6
  const bStep = cW / weeks

  const bars = buckets.map((b,i) => {
    const bH = b.count > 0 ? Math.max((b.count / maxCount) * cH, 3) : 0
    const x  = PL + i * bStep + (bStep - bW) / 2
    const y  = PT + cH - bH
    const fill = b.isCurrent ? 'var(--accent)' : 'var(--accent-2)'
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}"
        fill="${fill}" rx="3" opacity="${b.isCurrent ? '1' : '0.7'}"/>
      ${b.count > 0 ? `<text x="${(x+bW/2).toFixed(1)}" y="${(y-3).toFixed(1)}" text-anchor="middle"
        font-size="8" fill="${fill}" font-weight="600">${b.count}</text>` : ''}`
  }).join('')

  const totalW = buckets.reduce((s,b)=>s+b.count,0)
  const avgW   = (totalW / weeks).toFixed(1)

  return `
    <div class="chart-header">
      <span class="chart-title">Activities / week</span>
      <span class="chart-sub">avg ${avgW}/wk over ${weeks} weeks</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="week-svg">
      ${bars}
    </svg>`
}

export function activityStatsHTML(data, nDays = 30) {
  let sessions = 0, totalCal = 0, totalDist = 0, distCount = 0
  let totalHR = 0, hrCount = 0, totalDur = 0, durCount = 0
  for (let i = 0; i < nDays; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    for (const w of (data.workouts[ds] || [])) {
      sessions++
      totalCal  += w.calories_burned || 0
      if (w.duration_min)   { totalDur  += w.duration_min;   durCount++ }
      if (w.distance_km)    { totalDist += w.distance_km;    distCount++ }
      if (w.heart_rate_avg) { totalHR   += w.heart_rate_avg; hrCount++ }
    }
  }

  const stats = [
    { label: 'Sessions',    value: sessions,                          unit: '' },
    { label: 'Cal burned',  value: totalCal ? round(totalCal) : '—', unit: totalCal ? ' kcal' : '' },
  ]
  if (durCount > 0)  stats.push({ label: 'Avg duration',   value: Math.round(totalDur / durCount),   unit: ' min' })
  if (distCount > 0) stats.push({ label: 'Total distance',  value: totalDist.toFixed(1),              unit: ' km' })
  if (hrCount > 0)   stats.push({ label: 'Avg heart rate',  value: Math.round(totalHR / hrCount),     unit: ' bpm' })
  if (!durCount && !distCount && !hrCount && sessions > 0)
    stats.push({ label: 'Avg cal/session', value: totalCal ? round(totalCal / sessions) : '—', unit: totalCal ? ' kcal' : '' })

  return `<div class="activity-stats-grid">${stats.slice(0, 3).map(s => `
    <div class="activity-stat">
      <div class="activity-stat-val">${s.value}<span class="activity-stat-unit">${s.unit}</span></div>
      <div class="activity-stat-label">${s.label}</div>
    </div>`).join('')}</div>`
}

export function activityTypeBreakdownHTML(data, nDays = 30) {
  const counts = {}
  let total = 0
  for (let i = 0; i < nDays; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    for (const w of (data.workouts[ds] || [])) {
      const type = w.activity_type || detectActivityType(w.description)
      counts[type] = (counts[type] || 0) + 1
      total++
    }
  }
  if (!total) return '<div class="empty" style="padding:8px 0">No activities yet.</div>'

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const rows = sorted.map(([type, count]) => {
    const info = ACTIVITY_TYPE[type] || ACTIVITY_TYPE.lift
    const pct  = Math.round((count / total) * 100)
    return `
      <div class="type-bar-row">
        <div class="type-bar-emoji">${info.emoji}</div>
        <div class="type-bar-label">${info.label}</div>
        <div class="type-bar-track">
          <div class="type-bar-fill" style="width:${pct}%;background:${info.color}"></div>
        </div>
        <div class="type-bar-count">${count}</div>
      </div>`
  }).join('')

  return `
    <div class="chart-header">
      <span class="chart-title">By type</span>
      <span class="chart-sub">${total} total</span>
    </div>
    ${rows}`
}

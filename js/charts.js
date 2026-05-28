import { TARGETS, MEAL_ORDER, MEAL_LABEL, ACTIVITY_TYPE, detectActivityType } from './config.js'
import { dateStr, sumFood, fmt, round, calculateNetActiveCalories } from './utils.js'
import { typeIcon } from './icons.js'

// Consistent macro colors used across all charts.
export const MACRO_COLORS = {
  protein: 'var(--accent)',
  carbs:   '#3b82f6',
  fat:     '#f59e0b',
}

// Typical ring-fraction for each meal type (eating window 7am–10pm = 0→1).
const MEAL_TIME_FRAC = {
  breakfast: (8    - 7) / 15,  // 8:00 am  → 0.07
  lunch:     (12.5 - 7) / 15,  // 12:30 pm → 0.37
  snack:     (15   - 7) / 15,  // 3:00 pm  → 0.53
  dinner:    (19   - 7) / 15,  // 7:00 pm  → 0.80
}

// Returns the triangle fraction based on which meal types have been logged today.
// Advances in a step each time a new (later-timed) meal category appears.
function mealTargetFraction(food) {
  if (!food || !food.length) return 0
  const logged = new Set(food.map(e => e.meal).filter(Boolean))
  let frac = 0
  for (const [meal, f] of Object.entries(MEAL_TIME_FRAC)) {
    if (logged.has(meal) && f > frac) frac = f
  }
  return frac
}

// SVG triangle marker just outside the ring, pointing inward.
// Placed outside the ring stroke so it's always visible against the page background.
// Requires overflow="visible" on the parent SVG.
function ringTickSVG(cx, cy, r, sw, frac) {
  if (frac <= 0) return ''
  const angle = -Math.PI / 2 + frac * 2 * Math.PI
  const dx = Math.cos(angle), dy = Math.sin(angle)
  const px = -dy, py = dx
  const gap = 4, depth = 9, half = 5
  const tipR  = r + sw / 2 + gap
  const baseR = tipR + depth
  const tipX  = (cx + tipR  * dx).toFixed(1), tipY  = (cy + tipR  * dy).toFixed(1)
  const b1X   = (cx + baseR * dx + half * px).toFixed(1), b1Y = (cy + baseR * dy + half * py).toFixed(1)
  const b2X   = (cx + baseR * dx - half * px).toFixed(1), b2Y = (cy + baseR * dy - half * py).toFixed(1)
  return `<polygon points="${tipX},${tipY} ${b1X},${b1Y} ${b2X},${b2Y}"
    fill="var(--tx2)" stroke="var(--bg)" stroke-width="1.5" stroke-linejoin="round"
    style="animation:dot-pop .3s ease both .75s"/>`
}

export function calRingHTML(consumed, target, burned = 0, food = []) {
  const effectiveTarget = target + burned
  const size = 160, sw = 12, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(consumed / effectiveTarget, 1)
  const off  = circ * (1 - pct)
  const cx = size / 2, cy = size / 2
  const mealFrac = mealTargetFraction(food)
  const rem   = effectiveTarget - consumed

  // Inner ring for burned calories
  const ri = r - sw - 3, swi = 5
  const circi = 2 * Math.PI * ri
  const burnPct = burned > 0 ? Math.min(burned / effectiveTarget, 1) : 0
  const burnOff = circi * (1 - burnPct)

  return `
    <div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" overflow="visible">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${sw}"
          stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          style="--ring-circ:${circ.toFixed(2)};--ring-off:${off.toFixed(2)};animation:ring-fill .7s cubic-bezier(.4,0,.2,1) both"/>
        ${ringTickSVG(cx, cy, r, sw, mealFrac)}
        ${burned > 0 ? `
        <circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="var(--track)" stroke-width="${swi}" opacity="0.7"/>
        <circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="#f97316" stroke-width="${swi}"
          stroke-dasharray="${circi.toFixed(2)}" stroke-dashoffset="${burnOff.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          style="--ring-circ:${circi.toFixed(2)};--ring-off:${burnOff.toFixed(2)};animation:ring-fill .7s cubic-bezier(.4,0,.2,1) .1s both"/>` : ''}
      </svg>
      <div class="ring-center">
        <div class="ring-big-num">${round(consumed).toLocaleString()}</div>
        <div class="ring-unit">kcal</div>
        <div class="ring-remaining ${consumed > effectiveTarget ? 'over' : ''}">
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
  const color = value > target ? 'var(--danger)' : accentColor

  return `
    <div class="macro-ring-card">
      <div class="macro-ring-label">${label}</div>
      <div class="ring-wrap" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
            style="--ring-circ:${circ.toFixed(2)};--ring-off:${off.toFixed(2)};animation:ring-fill .7s cubic-bezier(.4,0,.2,1) both"/>
        </svg>
        <div class="ring-center">
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:var(--tx);line-height:1">
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
      target: TARGETS.calories.rest + calculateNetActiveCalories(workouts, TARGETS.calories.bmr),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    })
  }

  const maxCal = Math.max(...days.map(d => Math.max(d.cals, d.target)), TARGETS.calories.rest * 1.1, 100)
  const restTargetY = PT + (1 - TARGETS.calories.rest / maxCal) * cH
  const bW = cW / 7 * 0.6
  const bStep = cW / 7

  const bars = days.map((d, i) => {
    const bH = d.cals > 0 ? Math.max((d.cals / maxCal) * cH, 3) : 0
    const x  = PL + i * bStep + (bStep - bW) / 2
    const y  = PT + cH - bH
    const pct = d.cals / d.target
    const fill = d.cals === 0 ? 'var(--track)' : pct > 1.1 ? 'var(--danger)' : 'var(--accent)'
    const opacity = d.cals === 0 ? '1' : pct > 1.1 ? '0.9' : Math.max(0.15, Math.min(pct, 1)).toFixed(2)
    const labelFill = d.isToday ? 'var(--tx)' : 'var(--tx3)'
    const delay = `${(i * 0.06).toFixed(2)}s`
    return `
      <g class="bar-group" style="--bar-delay:${delay}">
        <rect class="bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}"
          fill="${fill}" rx="4" opacity="${opacity}"/>
        <text x="${(x+bW/2).toFixed(1)}" y="${(H-6).toFixed(1)}" text-anchor="middle"
          font-size="9" fill="${labelFill}" font-weight="${d.isToday ? '700' : '400'}">${d.label}</text>
        ${d.cals > 0
          ? `<text class="bar-cal-label" x="${(x+bW/2).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle"
              font-size="8" fill="${fill}" font-weight="600">${Math.round(d.cals)}</text>`
          : ''}
      </g>`
  }).join('')

  const wkAvg = round(days.reduce((s,d) => s+d.cals, 0) / Math.max(days.filter(d=>d.cals>0).length, 1))
  return `
    <div class="chart-header">
      <span class="chart-title">This week</span>
      <span class="chart-sub">avg ${wkAvg.toLocaleString()} kcal/day</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="week-svg">
      <text x="${PL-4}" y="${(restTargetY+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">${Math.round(TARGETS.calories.rest)}</text>
      <text x="${PL-4}" y="${(PT+cH+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">0</text>
      <line x1="${PL}" y1="${restTargetY.toFixed(1)}" x2="${(W-PR).toFixed(1)}" y2="${restTargetY.toFixed(1)}"
        stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3"/>
      ${bars}
    </svg>`
}

function buildCalorieTrendHTML(days, { title, primaryLabel, secondaryLabel, primaryColor, secondaryColor }) {
  const W = 320, H = 108, PL = 30, PR = 8, PT = 10, PB = 24
  const cW = W - PL - PR, cH = H - PT - PB
  const dataMax = Math.max(...days.map(d => Math.max(d.primary, d.secondary)), 0)
  const maxCal = Math.max(Math.max(dataMax, TARGETS.calories.rest) * 1.1, 100)
  const tY = (v) => {
    const clamped = Math.max(0, Math.min(v, maxCal))
    return PT + (1 - clamped / maxCal) * cH
  }
  const xStep = cW / (days.length - 1)

  const pts = days.map((day, i) => ({
    x: PL + i * xStep,
    primaryY: tY(day.primary || 0),
    secondaryY: tY(day.secondary || 0),
    date: day.d,
    isToday: day.isToday,
  }))

  let primaryPaths = [], primaryAreaPaths = [], primarySeg = '', currentSegmentPts = []
  let secondaryPaths = [], secondarySeg = ''
  
  pts.forEach(p => {
    if (p.primaryY !== null) {
      primarySeg += (primarySeg ? ' L' : 'M') + `${p.x.toFixed(1)},${p.primaryY.toFixed(1)}`
      currentSegmentPts.push(p)
    } else {
      if (primarySeg) {
        primaryPaths.push(primarySeg)
        if (currentSegmentPts.length >= 2) {
          primaryAreaPaths.push(primarySeg 
            + ` L${currentSegmentPts[currentSegmentPts.length-1].x.toFixed(1)},${(PT+cH).toFixed(1)}`
            + ` L${currentSegmentPts[0].x.toFixed(1)},${(PT+cH).toFixed(1)} Z`)
        }
        primarySeg = ''
        currentSegmentPts = []
      }
    }
    
    if (p.secondaryY !== null) { secondarySeg += (secondarySeg ? ' L' : 'M') + `${p.x.toFixed(1)},${p.secondaryY.toFixed(1)}` }
    else if (secondarySeg)     { secondaryPaths.push(secondarySeg); secondarySeg = '' }
  })
  
  if (primarySeg) {
    primaryPaths.push(primarySeg)
    if (currentSegmentPts.length >= 2) {
      primaryAreaPaths.push(primarySeg 
        + ` L${currentSegmentPts[currentSegmentPts.length-1].x.toFixed(1)},${(PT+cH).toFixed(1)}`
        + ` L${currentSegmentPts[0].x.toFixed(1)},${(PT+cH).toFixed(1)} Z`)
    }
  }
  if (secondarySeg) secondaryPaths.push(secondarySeg)

  const restY = tY(TARGETS.calories.rest)
  const activeDays = days.filter(d => d.primary > 0)
  const avg = activeDays.length ? round(activeDays.reduce((s,d)=>s+d.primary,0)/activeDays.length) : 0
  const todayPt = pts[pts.length - 1]
  const secondaryAvg = days.filter(d => d.secondary > 0).length
    ? round(days.filter(d => d.secondary > 0).reduce((s,d) => s + d.secondary, 0) / days.filter(d => d.secondary > 0).length)
    : 0

  const ticks = pts.filter(p => p.date.getDate() === 1 || p.date.getDate() === 15)
  const tickLabels = ticks.map(p =>
    `<text x="${p.x.toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" dominant-baseline="hanging" font-size="8" fill="var(--tx3)">
      ${p.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
    </text>`).join('')

  const validDays = days.filter(d => d.primary > 0 && d.secondary > 0)
  let diffHtml = ''
  if (validDays.length > 0) {
    const isBurnedPrimary = primaryLabel === 'burned'
    const totalBurn = validDays.reduce((s,d) => s + (isBurnedPrimary ? d.primary : d.secondary), 0)
    const totalInput = validDays.reduce((s,d) => s + (isBurnedPrimary ? d.secondary : d.primary), 0)
    const avgDiff = Math.round((totalInput - totalBurn) / validDays.length)
    
    if (Math.abs(avgDiff) > 10) {
      const diffText = avgDiff > 0 ? `+${avgDiff.toLocaleString()} surplus/day` : `${Math.abs(avgDiff).toLocaleString()} deficit/day`
      const diffColor = avgDiff > 0 ? 'var(--danger)' : 'var(--accent)'
      diffHtml = `<span style="padding:2px 6px;border-radius:4px;background:${diffColor}15;color:${diffColor};font-size:10px;font-weight:600;line-height:1">${diffText}</span>`
    } else {
      diffHtml = `<span style="padding:2px 6px;border-radius:4px;background:var(--track);color:var(--tx2);font-size:10px;font-weight:600;line-height:1">Balanced avg</span>`
    }
  }

  const uid = title.replace(/\W+/g, '').toLowerCase().slice(0, 14)

  return `
    <div class="chart-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="chart-title" style="margin-bottom:0">${title}</span>
        ${diffHtml}
      </div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="week-svg chart-fade-in">
      <defs>
        <linearGradient id="cal-grad-primary-${uid}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity=".18"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity=".01"/>
        </linearGradient>
        <linearGradient id="cal-grad-secondary-${uid}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${secondaryColor}" stop-opacity=".10"/>
          <stop offset="100%" stop-color="${secondaryColor}" stop-opacity=".01"/>
        </linearGradient>
      </defs>
      <text x="${PL-4}" y="${(restY+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">${Math.round(TARGETS.calories.rest)}</text>
      <text x="${PL-4}" y="${(PT+cH+3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--tx3)">0</text>
      <line x1="${PL}" y1="${(PT+cH).toFixed(1)}" x2="${(W-PR).toFixed(1)}" y2="${(PT+cH).toFixed(1)}"
        stroke="var(--border)" stroke-width="1" stroke-opacity=".6"/>
      <line x1="${PL}" y1="${restY.toFixed(1)}" x2="${(W-PR).toFixed(1)}" y2="${restY.toFixed(1)}"
        stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3"/>
      ${primaryAreaPaths.map(area => `<path d="${area}" fill="url(#cal-grad-primary-${uid})" style="animation:chart-fade-in 0.6s ease both 0.3s"/>`).join('')}
      ${secondaryPaths.map(p => `<path d="${p}" fill="none" stroke="${secondaryColor}" stroke-width="1.6" stroke-opacity=".55"
        stroke-linecap="round" stroke-linejoin="round"
        stroke-dasharray="10000" style="animation:line-draw 0.9s cubic-bezier(0.22,1,0.36,1) both 0.1s"/>`).join('')}
      ${primaryPaths.map(p => `<path d="${p}" fill="none" stroke="${primaryColor}" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"
        stroke-dasharray="10000" style="animation:line-draw 0.9s cubic-bezier(0.22,1,0.36,1) both"/>`).join('')}
      ${todayPt.primaryY !== null ? `<circle cx="${todayPt.x.toFixed(1)}" cy="${todayPt.primaryY.toFixed(1)}" r="3" fill="${primaryColor}" style="animation:dot-pop 0.3s ease both 0.85s"/>` : ''}
      ${todayPt.secondaryY !== null ? `<circle cx="${todayPt.x.toFixed(1)}" cy="${todayPt.secondaryY.toFixed(1)}" r="2.5" fill="${secondaryColor}" fill-opacity=".45" style="animation:dot-pop 0.3s ease both 0.95s"/>` : ''}
      ${tickLabels}
    </svg>`
}

export function calTrendHTML(data, nDays = 30, options = {}) {
  const today = dateStr()
  const days = []
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    
    // TDEE = Rest Target + Net Active Calories
    const netActive = calculateNetActiveCalories(data.workouts[ds], TARGETS.calories.bmr)
    const tdee = TARGETS.calories.rest + netActive
    const foodItems = data.food[ds] || []
    const input = foodItems.length > 0 ? sumFood(foodItems).calories : null

    days.push({
      ds,
      primary: options.primary === 'burned' ? tdee : input,
      secondary: options.primary === 'burned' ? input : tdee,
      d,
      isToday: ds === today,
    })
  }

  const isBurnedPrimary = options.primary === 'burned'
  return buildCalorieTrendHTML(days, {
    title: options.title || (isBurnedPrimary ? 'Calorie burn' : 'Caloric intake'),
    primaryLabel: isBurnedPrimary ? 'burned' : 'input',
    secondaryLabel: isBurnedPrimary ? 'input' : 'burned',
    primaryColor: isBurnedPrimary ? '#f97316' : 'var(--accent)',
    secondaryColor: isBurnedPrimary ? 'var(--accent)' : '#f97316',
  })
}

export function mealMacroAvgHTML(data, nDays = 30) {
  const mealKeys = [...MEAL_ORDER, 'uncategorised']
  const totals = Object.fromEntries(mealKeys.map(meal => [meal, { calories: 0, protein: 0, carbs: 0, fat: 0 }]))

  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const grouped = {}

    for (const entry of (data.food[ds] || [])) {
      const meal = entry.meal || 'uncategorised'
      ;(grouped[meal] = grouped[meal] || []).push(entry)
    }

    for (const meal of mealKeys) {
      const dayTotals = sumFood(grouped[meal] || [])
      totals[meal].calories += dayTotals.calories
      totals[meal].protein += dayTotals.protein
      totals[meal].carbs += dayTotals.carbs
      totals[meal].fat += dayTotals.fat
    }
  }

  const averages = mealKeys.map(meal => {
    const avg = {
      calories: totals[meal].calories / nDays,
      protein: totals[meal].protein / nDays,
      carbs: totals[meal].carbs / nDays,
      fat: totals[meal].fat / nDays,
    }
    return {
      meal,
      label: MEAL_LABEL[meal] || (meal === 'uncategorised' ? 'Other' : meal),
      avg,
      totalMacros: avg.protein + avg.carbs + avg.fat,
    }
  }).filter(row => row.meal !== 'uncategorised' || row.totalMacros > 0 || row.avg.calories > 0)

  if (!averages.length) return '<div class="empty">No nutrition data yet.</div>'

  const maxStack = Math.max(...averages.map(row => row.totalMacros), 1)
  const segments = [
    { key: 'protein', label: 'Protein', color: MACRO_COLORS.protein },
    { key: 'carbs',   label: 'Carbs',   color: MACRO_COLORS.carbs },
    { key: 'fat',     label: 'Fat',     color: MACRO_COLORS.fat },
  ]

  const cols = averages.map((row, i) => {
    const macrosSummary = `P${fmt(row.avg.protein)} · C${fmt(row.avg.carbs)} · F${fmt(row.avg.fat)}`
    const barH = Math.round((row.totalMacros / maxStack) * 90)
    const delay = `${(i * 0.07).toFixed(2)}s`
    const segs = segments.map((seg, idx) => {
      const val = row.avg[seg.key]
      if (val <= 0) return ''
      const radius = idx === 0 ? 'border-radius:0 0 8px 8px;' : idx === segments.length - 1 ? 'border-radius:8px 8px 0 0;' : ''
      return `<div class="meal-macro-seg meal-macro-${seg.key}" title="${seg.label} ${fmt(val)}g" style="flex:${val};background:${seg.color};${radius}"></div>`
    }).join('')

    return `
      <div class="meal-macro-col" style="--bar-delay:${delay}">
        <div class="meal-macro-kcal" style="animation:bar-label-in 0.2s ease both;animation-delay:calc(${delay} + 0.3s)">${fmt(row.avg.calories)} kcal</div>
        <div class="meal-macro-bar macro-bar-rise" style="height:${barH}px">${segs}</div>
        <div class="meal-macro-label">${row.label}</div>
        <div class="meal-macro-detail">${macrosSummary}</div>
      </div>`
  }).join('')

  return `
    <div class="chart-header">
      <span class="chart-title">Macros intake</span>
      <span class="chart-sub">Stacked grams</span>
    </div>
    <div class="meal-macro-chart">
      ${cols}
    </div>
    <div class="meal-macro-legend">
      ${segments.map(seg => `<div class="meal-macro-legend-item"><span class="meal-macro-legend-swatch" style="background:${seg.color}"></span>${seg.label}</div>`).join('')}
    </div>`
}

export function macroBarsHTML(totals, label = "Today's macros") {
  const bars = [
    { label: 'Protein', val: totals.protein, target: TARGETS.protein, unit: 'g', color: MACRO_COLORS.protein },
    { label: 'Carbs',   val: totals.carbs,   target: TARGETS.carbs,   unit: 'g', color: MACRO_COLORS.carbs },
    { label: 'Fat',     val: totals.fat,     target: TARGETS.fat,     unit: 'g', color: MACRO_COLORS.fat },
  ]
  const rows = bars.map((b, i) => {
    const pct   = Math.min((b.val / b.target) * 100, 100).toFixed(2)
    const color = b.val > b.target ? 'var(--danger)' : b.color
    const delay = `${(i * 0.08).toFixed(2)}s`
    return `
      <div class="macro-bar-row">
        <div class="macro-bar-label">${b.label}</div>
        <div class="macro-bar-track">
          <div class="macro-bar-fill macro-fill-anim" style="width:${pct}%;background:${color};--anim-delay:${delay}"></div>
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
      <div class="streak-dot-wrap" style="--anim-delay:${(i * 0.05).toFixed(2)}s">
        <div class="streak-dot ${has ? 'filled' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}">
          ${has ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>
        <div class="dot-day-label">${lbl}</div>
      </div>`)
  }

  return `
    <div class="streak-number-wrap">
      <div class="streak-number">${weekStreak}</div>
      <div class="streak-label">week activity streak</div>
    </div>
    <div class="streak-dots">${dots.join('')}</div>`
}

export function sparklineHTML(weights, { compact = false } = {}) {
  if (weights.length < 2) return ''
  const ordered = [...weights].reverse()
  const vals = ordered.map(w => w.kg)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = maxV - minV || 0.5

  // compact=true → left column (~300px); compact=false → right/wide column (~700px+)
  // viewBox width is chosen so font-size:8 renders at ~8-10px in each context
  const W = compact ? 380 : 700, H = 80
  const LPAD = 38, RPAD = 8, TPAD = 10, BPAD = 10
  const chartW = W - LPAD - RPAD
  const chartH = H - TPAD - BPAD

  const xStep = chartW / (vals.length - 1 || 1)
  const pts = vals.map((v, i) => ({
    x: LPAD + i * xStep,
    y: TPAD + (1 - (v - minV) / range) * chartH,
  }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = line + ` L${pts[pts.length-1].x.toFixed(1)},${TPAD + chartH} L${pts[0].x.toFixed(1)},${TPAD + chartH} Z`

  const midV = (minV + maxV) / 2
  const ticks = range > 0.01
    ? [{ v: maxV, y: TPAD }, { v: midV, y: TPAD + chartH / 2 }, { v: minV, y: TPAD + chartH }]
    : [{ v: minV, y: TPAD + chartH / 2 }]

  const uid = 'wgt'
  return `
    <div class="sparkline-card">
      <div class="chart-header">
        <span class="chart-title">Weight trend</span>
        <span class="chart-sub">${ordered.length} entries · ${minV.toFixed(2)}–${maxV.toFixed(2)} kg</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
        <defs>
          <linearGradient id="wg-${uid}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity=".18"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity=".02"/>
          </linearGradient>
        </defs>
        ${ticks.map(t => `
          <line x1="${LPAD}" y1="${t.y.toFixed(1)}" x2="${W - RPAD}" y2="${t.y.toFixed(1)}"
            stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>
          <text x="${LPAD - 5}" y="${t.y.toFixed(1)}" text-anchor="end" dominant-baseline="middle"
            font-size="8" fill="var(--tx3)">${t.v.toFixed(1)}</text>
        `).join('')}
        <path d="${area}" fill="url(#wg-${uid})"/>
        <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--accent)"/>`).join('')}
      </svg>
    </div>`
}

export function monthNavHTML(monthOffset = 0) {
  const now = new Date()
  now.setDate(1)
  now.setMonth(now.getMonth() + monthOffset)
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const prevOffset = monthOffset - 1
  const nextOffset = monthOffset + 1
  const canGoNext  = monthOffset < 0
  return `
    <div class="hm-nav-row" style="align-items:center; margin-bottom: 12px;">
      <button type="button" class="hm-nav-btn" data-action="heatmap-month" data-offset="${prevOffset}">‹</button>
      <div class="hm-nav-title" style="font-size:14px;font-weight:600">${monthName}</div>
      <button type="button" class="hm-nav-btn" data-action="heatmap-month" data-offset="${nextOffset}" ${canGoNext ? '' : 'disabled'}>›</button>
    </div>`
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function parseCssColor(value) {
  const color = String(value || '').trim()
  if (!color) return null

  const hex = color.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    const raw = hex[1]
    const expand = (str) => str.length === 1 ? str + str : str
    if (raw.length === 3 || raw.length === 4) {
      return {
        r: parseInt(expand(raw[0]), 16),
        g: parseInt(expand(raw[1]), 16),
        b: parseInt(expand(raw[2]), 16),
      }
    }
    if (raw.length === 6 || raw.length === 8) {
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
      }
    }
  }

  const rgb = color.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(',').map(part => part.trim())
    if (parts.length >= 3) {
      return {
        r: Number(parts[0]),
        g: Number(parts[1]),
        b: Number(parts[2]),
      }
    }
  }

  return null
}

function mixRgbColors(base, accent, ratio) {
  const t = clamp(ratio, 0, 1)
  const r = Math.round(base.r + (accent.r - base.r) * t)
  const g = Math.round(base.g + (accent.g - base.g) * t)
  const b = Math.round(base.b + (accent.b - base.b) * t)
  return `rgb(${r} ${g} ${b})`
}

function nutritionHeatmapStyle(diff, target) {
  const rootStyles = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const accent = parseCssColor(rootStyles?.getPropertyValue('--accent')) || { r: 29, g: 122, b: 58 }
  const track = parseCssColor(rootStyles?.getPropertyValue('--track')) || { r: 233, g: 236, b: 242 }

  const absDiff = Math.abs(diff)
  const onTargetWindow = Math.max(50, target * 0.25)
  const scale = Math.max(target * 0.8, 400)
  const closeness = absDiff <= onTargetWindow ? 1 : clamp(1 - ((absDiff - onTargetWindow) / scale), 0.12, 1)
  const background = mixRgbColors(track, accent, closeness)
  const color = closeness > 0.7 ? '#fff' : 'var(--tx)'

  return { background, color, closeness, onTargetWindow }
}

export function monthHeatmapHTML(data, monthOffset = 0, type = 'workouts') {
  const now = new Date()
  now.setDate(1)
  now.setMonth(now.getMonth() + monthOffset)
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = dateStr()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7  // Mon=0

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(`<div class="hm-cell hm-empty"></div>`)
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = ds === today
    const isFuture = ds > today
    let cls = 'hm-cell'
    if (isToday)  cls += ' hm-today'
    if (isFuture) cls += ' hm-future'

    if (type === 'workouts') {
      const dayWorkouts = data.workouts[ds] || []
      const hasWorkout = dayWorkouts.some(w => !w.isDuplicate)
      if (hasWorkout) cls += ' hm-has'
      
      if (hasWorkout) {
        const w = dayWorkouts[0]
        const wtype = w.activity_type || detectActivityType(w.description)
        cells.push(`<div class="${cls}" style="cursor:pointer" data-action="goto-activity-date" data-date="${ds}" title="${w.description}">${typeIcon(wtype, 13)}</div>`)
      } else {
        cells.push(`<div class="${cls}" >${isFuture ? '' : day}</div>`)
      }
    } else if (type === 'nutrition') {
      const food = data.food[ds] || []
      if (food.length > 0) {
        const input = sumFood(food).calories
        const netActive = calculateNetActiveCalories(data.workouts[ds], TARGETS.calories.bmr)
        const tdee = TARGETS.calories.rest + netActive
        const diff = input - tdee

        const { background, color, onTargetWindow } = nutritionHeatmapStyle(diff, tdee)
        const absDiff = Math.abs(diff)
        const arrow = absDiff <= onTargetWindow ? '✓' : diff > 0 ? '↑' : '↓'
        const diffLabel = absDiff <= onTargetWindow
          ? `On target (${Math.round(input)} / ${Math.round(tdee)} kcal)`
          : `${Math.round(absDiff)} kcal ${diff > 0 ? 'surplus' : 'deficit'} (${Math.round(input)} / ${Math.round(tdee)} kcal)`

        cls += ' hm-has'
        cells.push(`<div class="${cls} hm-nutrition" data-action="goto-activity-date" data-date="${ds}" style="cursor:pointer;background:${background};color:${color}" title="${diffLabel}"><span class="hm-day">${day}</span><span class="hm-arrow">${arrow}</span></div>`)
      } else {
        cells.push(`<div class="${cls}" >${isFuture ? '' : day}</div>`)
      }
    }
  }

  return `
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
  const avgW   = (totalW / weeks).toFixed(2)

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
    const dayWorkouts = data.workouts[ds] || []
    totalCal += calculateNetActiveCalories(dayWorkouts, TARGETS.calories.bmr)
    for (const w of dayWorkouts) {
      if (w.isDuplicate) continue
      sessions++
      if (w.duration_min)   { totalDur  += w.duration_min;   durCount++ }
      if (w.distance_km)    { totalDist += w.distance_km;    distCount++ }
      if (w.heart_rate_avg) { totalHR   += w.heart_rate_avg; hrCount++ }
    }
  }

  const stats = [
    { label: 'Sessions',    value: sessions,                          unit: '' },
    { label: 'Cal burned (excl. BMR)',  value: totalCal ? round(totalCal) : '—', unit: totalCal ? ' kcal' : '' },
  ]
  if (durCount > 0)  stats.push({ label: 'Avg duration',   value: Math.round(totalDur / durCount),   unit: ' min' })
  if (distCount > 0) stats.push({ label: 'Total distance',  value: totalDist.toFixed(2),              unit: ' km' })
  if (hrCount > 0)   stats.push({ label: 'Avg heart rate',  value: Math.round(totalHR / hrCount),     unit: ' bpm' })
  if (!durCount && !distCount && !hrCount && sessions > 0)
    stats.push({ label: 'Avg cal/session', value: totalCal ? round(totalCal / sessions) : '—', unit: totalCal ? ' kcal' : '' })

  return `<div class="activity-stats-grid">${stats.slice(0, 3).map(s => `
    <div class="activity-stat">
      <div class="activity-stat-val">${s.value}<span class="activity-stat-unit">${s.unit}</span></div>
      <div class="activity-stat-label">${s.label}</div>
    </div>`).join('')}</div>`
}

export function activityTypeBreakdownHTML(data, year, month) {
  const counts = {}
  let total = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    for (const w of (data.workouts[ds] || [])) {
      if (w.isDuplicate) continue
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
        <div class="type-bar-icon">${typeIcon(type, 15)}</div>
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

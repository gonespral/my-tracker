import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import {
  dateStr, sumFood, calculateNetActiveCalories, calculateTotalActivityCalories, fmtDateShort,
} from '../lib/utils'
import { TARGETS, MEAL_ORDER, getCalorieGoal } from '../lib/config'
import { MACRO_COLORS } from '../lib/chartColors'
import { useAppStore } from '../store'
import type { DbCache } from '../store'
import { openFoodSheet, openActivitySheet, openWeightSheet, openEditWeightSheet } from '../lib/sheets'
import CalRing from '../components/charts/CalRing'
import MacroRing from '../components/charts/MacroRing'
import FoodItem from '../components/FoodItem'
import { ActivityItem, ActivityStack, groupActivitiesByConflict } from '../components/ActivityItem'
import EntryMenu from '../components/EntryMenu'
import Icon from '../components/Icon'
import WisdomCard from '../components/WisdomCard'

const MEAL_TIME_ORDER = ['breakfast', 'lunch', 'snack', 'dinner']
// Fraction of the eating window (7 am–10 pm) at which each meal is expected to be done.
const MEAL_POS: Record<string, number> = { breakfast: 0.133, lunch: 0.4, snack: 0.6, dinner: 0.867 }

function timeOfDayFrac() {
  const EATING_START = 7, EATING_END = 22
  const now = new Date()
  const t = now.getHours() + now.getMinutes() / 60
  if (t <= EATING_START) return 0
  if (t >= EATING_END) return 1
  return (t - EATING_START) / (EATING_END - EATING_START)
}

// Returns expected-cals-consumed-by-now / effectiveTarget based on 30-day meal history
// and the current time of day. Values >1 signal overflow (target already exceeded by pace).
function computeMealFrac(data: DbCache, effectiveTarget: number) {
  const t = timeOfDayFrac()
  if (t <= 0) return 0

  const sums = Object.fromEntries(MEAL_TIME_ORDER.map((m) => [m, 0]))
  const daysSeen = Object.fromEntries(MEAL_TIME_ORDER.map((m) => [m, 0]))
  for (let i = 1; i <= 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dayMealCals: Record<string, number> = {}
    for (const e of (data.food[dateStr(d)] || [])) {
      if (e.meal && e.meal in sums) dayMealCals[e.meal] = (dayMealCals[e.meal] || 0) + (e.calories || 0)
    }
    for (const m of MEAL_TIME_ORDER) {
      if (m in dayMealCals) { sums[m] += dayMealCals[m]; daysSeen[m]++ }
    }
  }

  const totalDays = Object.values(daysSeen).reduce((s, c) => s + c, 0)
  if (totalDays === 0 || effectiveTarget <= 0) return t

  const knownAvgs = MEAL_TIME_ORDER.map((m) => daysSeen[m] > 0 ? sums[m] / daysSeen[m] : null)
  const knownVals = knownAvgs.filter((v): v is number => v !== null)
  const fallback = knownVals.length > 0 ? knownVals.reduce((s, v) => s + v, 0) / knownVals.length : 0
  const avgs = Object.fromEntries(MEAL_TIME_ORDER.map((m, i) => [m, knownAvgs[i] ?? fallback]))

  let expected = 0
  for (let i = 0; i < MEAL_TIME_ORDER.length; i++) {
    const m = MEAL_TIME_ORDER[i]
    const pos = MEAL_POS[m]
    const prevPos = i > 0 ? MEAL_POS[MEAL_TIME_ORDER[i - 1]] : 0
    if (t >= pos) expected += avgs[m]
    else if (t > prevPos) expected += avgs[m] * (t - prevPos) / (pos - prevPos)
  }

  return expected / effectiveTarget
}

function WeightSection({ weights, today, onChanged }: { weights: { date: string; kg: number }[]; today: string; onChanged: () => void }) {
  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date))
  const todayEntry = sorted.find((w) => w.date === today)
  if (!todayEntry) {
    return <button className="log-add-btn" onClick={() => openWeightSheet(today)}>+ Log weight</button>
  }
  const prev = sorted.find((w) => w.date < today)
  const delta = prev ? todayEntry.kg - prev.kg : null
  const cls = delta === null ? '' : delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'same'
  const todayDate = todayEntry.date

  async function handleDelete() {
    await db.deleteWeight(todayDate)
    onChanged()
  }

  return (
    <>
      <button className="log-add-btn" onClick={() => openWeightSheet(today)}>+ Log weight</button>
      <div className="weight-entry">
        <div className="weight-entry-date">{fmtDateShort(todayEntry.date)}</div>
        <div className="weight-entry-right">
          {delta !== null && <span className={`delta ${cls}`}>{delta > 0 ? '+' : ''}{delta.toFixed(2)} kg</span>}
          <div className="weight-entry-kg">{todayEntry.kg.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--tx3)' }}> kg</span></div>
        </div>
        <EntryMenu>
          <button onClick={() => openEditWeightSheet(todayEntry)}>Edit</button>
          <button className="danger" onClick={handleDelete}>Delete</button>
        </EntryMenu>
      </div>
    </>
  )
}

export default function TodayTab() {
  const [data, setData] = useState<DbCache | null>(null)
  const expandedGroups = useAppStore((s) => s.expandedConflictGroups)
  const dailyDate = useAppStore((s) => s.dailyDate)

  const dataGen = useAppStore((s) => s.dataGen)
  function reload() {
    db.bust()
  }

  useEffect(() => {
    db.load().then(setData)
  }, [dataGen])

  if (!data) return <div className="today-inner">Loading…</div>

  const today = dateStr()
  const selectedDate = dailyDate ?? today
  const isToday = selectedDate === today
  const food = data.food[selectedDate] || []
  const workouts = data.workouts[selectedDate] || []
  const totals = sumFood(food)
  const calTarget = getCalorieGoal()
  const burnedToday = calculateNetActiveCalories(workouts)
  const burnedTotalToday = calculateTotalActivityCalories(workouts, TARGETS.calories.bmr || 1800)
  const eatbackPct = TARGETS.calories.eatback_enabled !== false ? (TARGETS.calories.eatback_pct ?? 50) : 0
  const eatback = burnedToday > 0 ? Math.round(burnedToday * eatbackPct / 100) : 0
  const effectiveTarget = calTarget + eatback

  const orderedFood = food
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const mealA = MEAL_ORDER.indexOf((a.entry.meal as typeof MEAL_ORDER[number]) || 'snack')
      const mealB = MEAL_ORDER.indexOf((b.entry.meal as typeof MEAL_ORDER[number]) || 'snack')
      return (mealA - mealB) || (a.index - b.index)
    })
    .map(({ entry }) => entry)

  function toggleGroup(groupId: string) {
    const next = new Set(expandedGroups)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    useAppStore.setState({ expandedConflictGroups: next })
  }

  return (
    <div className="today-inner">
      <div className="today-left">
        <div className="cal-section">
          <CalRing consumed={totals.calories} target={effectiveTarget} burned={burnedToday} mealFrac={isToday ? computeMealFrac(data, effectiveTarget) : 1} />
          <div className="cal-badges">
            <span className="badge">Target: {effectiveTarget.toLocaleString()} kcal{eatback > 0 ? ` (+${eatback} eat-back)` : ''}</span>
            {burnedToday > 0 && (
              <span className="badge badge-burned">
                <span className="badge-burned-active"><Icon name="local_fire_department" size={13} style={{ verticalAlign: 'middle' }} /> {burnedToday.toLocaleString()} burned</span>
                {burnedTotalToday > burnedToday && <span className="badge-burned-total">{burnedTotalToday.toLocaleString()} total</span>}
              </span>
            )}
          </div>
        </div>
        <div className="macro-rings">
          <MacroRing label="Protein" value={totals.protein} target={TARGETS.protein} unit="g" accentColor={MACRO_COLORS.protein} />
          <MacroRing label="Carbs" value={totals.carbs} target={TARGETS.carbs} unit="g" accentColor={MACRO_COLORS.carbs} />
          <MacroRing label="Fat" value={totals.fat} target={TARGETS.fat} unit="g" accentColor={MACRO_COLORS.fat} />
        </div>
        {isToday && <WisdomCard />}
      </div>
      <div className="today-right" id="today-logs">
        <div className="section-label">Food</div>
        {orderedFood.map((e) => <FoodItem key={e.id} entry={e} onDeleted={reload} />)}
        <button className="log-add-btn" onClick={() => openFoodSheet(selectedDate)}>+ Add meal</button>

        <div className="section-label" style={{ marginTop: 14 }}>Activities</div>
        {groupActivitiesByConflict(workouts).map((item) =>
          item.type === 'stack'
            ? <ActivityStack key={item.groupId} entries={item.entries} expanded={expandedGroups.has(item.groupId)} onToggle={() => toggleGroup(item.groupId)} onChanged={reload} />
            : <ActivityItem key={item.entry.id} entry={item.entry} onChanged={reload} />
        )}
        <button className="log-add-btn" onClick={() => openActivitySheet(selectedDate)}>+ Add activity</button>

        <div className="section-label" style={{ marginTop: 14 }}>Weight</div>
        <WeightSection weights={data.weights || []} today={selectedDate} onChanged={reload} />
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { db } from '../../lib/db'
import { dateStr } from '../../lib/utils'
import { MEAL_ORDER, MEAL_LABEL } from '../../lib/config'
import { showToast } from '../../lib/toast'
import { estimateNutritionFromDescription } from '../../lib/ai'
import Sheet from '../Sheet'
import AutocompleteInput from '../AutocompleteInput'
import Icon from '../Icon'

const ALL_MEALS = [...MEAL_ORDER]

export default function FoodSheet() {
  const open = useAppStore((s) => s.openSheetId === 'food')
  const editing = useAppStore((s) => s.editingFood)
  const sheetDate = useAppStore((s) => s.sheetDate)
  const mealsCache = useAppStore((s) => s.mealsCache)

  // The cache is loaded on sign-in but invalidated whenever Claude saves a
  // new preset; reload lazily so autocomplete sees the latest presets.
  useEffect(() => {
    if (!open || mealsCache) return
    db.loadMeals().then((m) => useAppStore.setState({ mealsCache: m })).catch(() => {})
  }, [open, mealsCache])

  const [date, setDate] = useState(dateStr())
  const [meal, setMeal] = useState<string>('breakfast')
  const [desc, setDesc] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDate(editing.date || dateStr())
      setMeal(editing.meal || 'breakfast')
      setDesc(editing.description || '')
      setCalories(editing.calories ? String(editing.calories) : '')
      setProtein(editing.protein ? String(editing.protein) : '')
      setCarbs(editing.carbs ? String(editing.carbs) : '')
      setFat(editing.fat ? String(editing.fat) : '')
    } else {
      setDate(sheetDate || dateStr())
      setMeal('snack')
      setDesc('')
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
    }
  }, [open, editing, sheetDate])

  const q = desc.toLowerCase().trim()
  const suggestions = q && mealsCache
    ? mealsCache
        .filter((m) => m.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((m) => ({ id: m.id, name: m.name, calories: m.calories || 0 }))
    : []

  function handlePickPreset(id: string) {
    const m = (mealsCache || []).find((x) => x.id === id)
    if (!m) return
    setDesc(m.name)
    setCalories(m.calories ? String(m.calories) : '')
    setProtein(m.protein ? String(m.protein) : '')
    setCarbs(m.carbs ? String(m.carbs) : '')
    setFat(m.fat ? String(m.fat) : '')
    if (m.meal) setMeal(m.meal)
    document.getElementById('f-cal')?.focus()
  }

  const [estimating, setEstimating] = useState(false)

  async function handleAutoEstimate() {
    const trimmed = desc.trim()
    if (!trimmed || estimating) return
    setEstimating(true)
    try {
      const result = await estimateNutritionFromDescription(trimmed)
      if (!result) { showToast('Could not estimate — try a more specific description'); return }
      setCalories(String(result.calories))
      setProtein(String(result.protein))
      setCarbs(String(result.carbs))
      setFat(String(result.fat))
      showToast('Nutrition estimated')
    } catch (err) {
      showToast((err as Error).message || 'Estimate failed')
    } finally {
      setEstimating(false)
    }
  }

  async function handleSave() {
    const trimmed = desc.trim()
    if (!trimmed) return
    const entry = {
      description: trimmed,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      meal,
    }
    setSaving(true)
    try {
      if (editing?.id) {
        await db.updateFood(editing.id, entry)
        showToast(`Updated ${trimmed}`)
      } else {
        await db.addFood(date, entry)
        showToast(`Logged ${trimmed}`)
      }
      closeSheet()
    } catch (err) {
      showToast((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={editing ? 'Edit Food' : 'Log Food'}>
      <div className="form-field">
        <label className="form-label" htmlFor="f-date">Date</label>
        <input className="form-input" id="f-date" type="date" value={date} disabled={!!editing} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">Meal</label>
        <div className="meal-btns">
          {ALL_MEALS.map((m) => (
            <button key={m} type="button" className={`meal-btn${meal === m ? ' active' : ''}`} onClick={() => setMeal(m)}>
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="f-desc">Description</label>
        <AutocompleteInput
          id="f-desc"
          placeholder="e.g. Pasta pesto + 2 eggs"
          value={desc}
          suggestions={suggestions}
          onChange={setDesc}
          onSelect={handlePickPreset}
          endButton={
            <button
              type="button"
              className={`desc-magic-btn${estimating ? ' loading' : ''}`}
              aria-label="Auto-calculate nutrition from description"
              data-tip="Auto-calculate from description"
              disabled={!desc.trim() || estimating}
              onClick={handleAutoEstimate}
            >
              <Icon name="auto_awesome" size={18} />
            </button>
          }
        />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="f-cal">Calories (kcal)</label>
        <input className="form-input" id="f-cal" type="number" inputMode="numeric" placeholder="0" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} />
      </div>
      <div className="form-macros">
        <div className="form-field">
          <label className="form-label" htmlFor="f-pro">Protein (g)</label>
          <input className="form-input" id="f-pro" type="number" inputMode="numeric" placeholder="0" min={0} value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="f-car">Carbs (g)</label>
          <input className="form-input" id="f-car" type="number" inputMode="numeric" placeholder="0" min={0} value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="f-fat">Fat (g)</label>
          <input className="form-input" id="f-fat" type="number" inputMode="numeric" placeholder="0" min={0} value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>{editing ? 'Update Food' : 'Log Food'}</button>
    </Sheet>
  )
}

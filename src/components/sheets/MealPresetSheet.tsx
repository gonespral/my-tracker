import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { db } from '../../lib/db'
import { MEAL_ORDER, MEAL_LABEL } from '../../lib/config'
import { showToast } from '../../lib/toast'
import Sheet from '../Sheet'

const ALL_MEALS = [...MEAL_ORDER]

export default function MealPresetSheet() {
  const open = useAppStore((s) => s.openSheetId === 'mealPreset')
  const editing = useAppStore((s) => s.editingMealPreset)

  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [meal, setMeal] = useState<string>('snack')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editing?.name || '')
    setCalories(editing?.calories ? String(editing.calories) : '')
    setProtein(editing?.protein ? String(editing.protein) : '')
    setCarbs(editing?.carbs ? String(editing.carbs) : '')
    setFat(editing?.fat ? String(editing.fat) : '')
    setMeal(editing?.meal || 'snack')
  }, [open, editing])

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const entry = {
      name: trimmed,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      meal,
    }
    setSaving(true)
    try {
      if (editing?.id) {
        await db.updateMeal(editing.id, entry)
        showToast('Meal updated')
      } else {
        await db.addMeal(entry)
        showToast('Meal saved')
      }
      useAppStore.setState({ mealsCache: null })
      closeSheet()
    } catch (err) {
      showToast((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={editing ? 'Edit Meal' : 'New Meal'}>
      <div className="form-field">
        <label className="form-label" htmlFor="mp-name">Name</label>
        <input className="form-input" id="mp-name" type="text" placeholder="e.g. Oats with protein" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="mp-cal">Calories (kcal)</label>
        <input className="form-input" id="mp-cal" type="number" inputMode="numeric" placeholder="0" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} />
      </div>
      <div className="form-macros">
        <div className="form-field">
          <label className="form-label" htmlFor="mp-pro">Protein (g)</label>
          <input className="form-input" id="mp-pro" type="number" inputMode="numeric" placeholder="0" min={0} value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="mp-car">Carbs (g)</label>
          <input className="form-input" id="mp-car" type="number" inputMode="numeric" placeholder="0" min={0} value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="mp-fat">Fat (g)</label>
          <input className="form-input" id="mp-fat" type="number" inputMode="numeric" placeholder="0" min={0} value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
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
      <button className="btn-primary" onClick={handleSave} disabled={saving}>{editing ? 'Update Meal' : 'Save Meal'}</button>
    </Sheet>
  )
}

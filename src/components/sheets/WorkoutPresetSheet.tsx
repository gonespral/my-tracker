import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { db } from '../../lib/db'
import { showToast } from '../../lib/toast'
import Sheet from '../Sheet'
import Icon from '../Icon'

const INTENSITIES = [
  { id: 'low', label: 'Low', icon: 'signal_cellular_alt_1_bar' },
  { id: 'medium', label: 'Medium', icon: 'signal_cellular_alt' },
  { id: 'high', label: 'High', icon: 'trending_up' },
] as const

export default function WorkoutPresetSheet() {
  const open = useAppStore((s) => s.openSheetId === 'workoutPreset')
  const editing = useAppStore((s) => s.editingWorkoutPreset)

  const [name, setName] = useState('')
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [calsBurned, setCalsBurned] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editing?.name || '')
    setIntensity((editing?.intensity as 'low' | 'medium' | 'high') || 'medium')
    setCalsBurned(editing?.calories_burned ? String(editing.calories_burned) : '')
  }, [open, editing])

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const entry = {
      name: trimmed,
      intensity,
      calories_burned: Number(calsBurned) || null,
    }
    setSaving(true)
    try {
      if (editing?.id) {
        await db.updateWorkoutPreset(editing.id, entry)
        showToast('Activity preset updated')
      } else {
        await db.addWorkoutPreset(entry)
        showToast('Activity preset saved')
      }
      useAppStore.setState({ workoutPresetsCache: null })
      closeSheet()
    } catch (err) {
      showToast((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={editing ? 'Edit Activity' : 'New Activity'}>
      <div className="form-field">
        <label className="form-label" htmlFor="wps-name">Name</label>
        <input className="form-input" id="wps-name" type="text" placeholder="e.g. Morning swim" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">Intensity</label>
        <div className="intensity-btns">
          {INTENSITIES.map((i) => (
            <button key={i.id} type="button" className={`intensity-btn${intensity === i.id ? ' active' : ''}`} onClick={() => setIntensity(i.id)}>
              <Icon name={i.icon} size={13} style={{ marginRight: 4 }} />
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="wps-calories-burned">Calories burned (optional)</label>
        <input className="form-input" id="wps-calories-burned" type="number" inputMode="numeric" placeholder="e.g. 350" min={0} value={calsBurned} onChange={(e) => setCalsBurned(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>{editing ? 'Update Activity' : 'Save Activity'}</button>
    </Sheet>
  )
}

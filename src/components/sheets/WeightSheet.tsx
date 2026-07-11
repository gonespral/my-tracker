import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { db } from '../../lib/db'
import { dateStr } from '../../lib/utils'
import { showToast } from '../../lib/toast'
import Sheet from '../Sheet'

export default function WeightSheet() {
  const open = useAppStore((s) => s.openSheetId === 'weight')
  const editing = useAppStore((s) => s.editingWeight)

  const [date, setDate] = useState(dateStr())
  const [kg, setKg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDate(editing.date)
      setKg(String(editing.kg))
    } else {
      setDate(dateStr())
      setKg('')
    }
  }, [open, editing])

  async function handleSave() {
    const kgNum = Number(kg)
    if (!kgNum || kgNum <= 0) return
    setSaving(true)
    try {
      await db.upsertWeight({ date, kg: kgNum })
      showToast(`Logged ${kgNum} kg`)
      closeSheet()
    } catch (err) {
      showToast((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={editing ? 'Edit Weight' : 'Log Weight'}>
      <div className="form-field">
        <label className="form-label" htmlFor="w-edit-date">Date</label>
        <input className="form-input" id="w-edit-date" type="date" value={date} disabled={!!editing} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="w-edit-kg">Weight (kg)</label>
        <input className="form-input" id="w-edit-kg" type="number" inputMode="decimal" placeholder="0.0" min={0} step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>{editing ? 'Update Weight' : 'Log Weight'}</button>
    </Sheet>
  )
}

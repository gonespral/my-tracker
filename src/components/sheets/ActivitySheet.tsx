import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { db } from '../../lib/db'
import { dateStr, nowTime } from '../../lib/utils'
import { ACTIVITY_TYPE } from '../../lib/config'
import { showToast } from '../../lib/toast'
import { stravaIsConnected, stravaAutoPushEnabled, pushActivityToStrava } from '../../lib/strava'
import { googleHealthIsConnected, ghAutoPushEnabled, pushActivityToGoogleHealth } from '../../lib/google-health'
import Sheet from '../Sheet'
import Icon from '../Icon'
import AutocompleteInput from '../AutocompleteInput'

const INTENSITIES = [
  { id: 'low', label: 'Low', icon: 'signal_cellular_alt_1_bar' },
  { id: 'medium', label: 'Medium', icon: 'signal_cellular_alt' },
  { id: 'high', label: 'High', icon: 'trending_up' },
] as const

const INTENSITY_TOAST: Record<string, string> = { low: 'Logged', medium: 'Logged', high: 'Logged' }

export default function ActivitySheet() {
  const open = useAppStore((s) => s.openSheetId === 'activity')
  const editing = useAppStore((s) => s.editingWorkout)
  const sheetDate = useAppStore((s) => s.sheetDate)
  const presetsCache = useAppStore((s) => s.workoutPresetsCache)

  // Loaded on sign-in but invalidated when presets change; reload lazily so
  // autocomplete sees the latest presets.
  useEffect(() => {
    if (!open || presetsCache) return
    db.loadWorkoutPresets().then((w) => useAppStore.setState({ workoutPresetsCache: w })).catch(() => {})
  }, [open, presetsCache])

  const [date, setDate] = useState(dateStr())
  const [time, setTime] = useState('')
  const [desc, setDesc] = useState('')
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [activityType, setActivityType] = useState('')
  const [calsBurned, setCalsBurned] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDate(editing.date || dateStr())
      setTime('')
      setDesc(editing.description || '')
      setIntensity((editing.intensity as 'low' | 'medium' | 'high') || 'medium')
      setActivityType(editing.activity_type || '')
      setCalsBurned(editing.calories_burned ? String(editing.calories_burned) : '')
      setDurationMin(editing.duration_min ? String(editing.duration_min) : '')
      setDistanceKm(editing.distance_km ? String(editing.distance_km) : '')
      setHeartRate('')
    } else {
      setDate(sheetDate || dateStr())
      setTime('')
      setDesc('')
      setIntensity('medium')
      setActivityType('')
      setCalsBurned('')
      setDurationMin('')
      setDistanceKm('')
      setHeartRate('')
    }
  }, [open, editing, sheetDate])

  const q = desc.toLowerCase().trim()
  const suggestions = q && presetsCache
    ? presetsCache
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, calories: p.calories_burned || undefined }))
    : []

  function handlePickPreset(id: string) {
    const p = (presetsCache || []).find((x) => x.id === id)
    if (!p) return
    setDesc(p.name)
    if (p.calories_burned) setCalsBurned(String(p.calories_burned))
    if (p.duration_min) setDurationMin(String(p.duration_min))
    if (p.distance_km) setDistanceKm(String(p.distance_km))
    if (p.heart_rate_avg) setHeartRate(String(p.heart_rate_avg))
    if (p.activity_type) setActivityType(p.activity_type)
    if (p.intensity) setIntensity(p.intensity as 'low' | 'medium' | 'high')
  }

  async function handleSave() {
    const trimmed = desc.trim()
    if (!trimmed) return
    const calsBurnedNum = Number(calsBurned) || null
    const durationMinNum = Number(durationMin) || null
    const distanceKmNum = Number(distanceKm) || null
    const heartRateNum = Number(heartRate) || null
    const timeIso = time ? `${date}T${time}:00` : null

    setSaving(true)
    try {
      if (editing?.id) {
        await db.updateWorkout(editing.id, {
          description: trimmed,
          intensity,
          activity_type: activityType || undefined,
          calories_burned: calsBurnedNum ?? undefined,
          duration_min: durationMinNum ?? undefined,
          distance_km: distanceKmNum,
          heart_rate_avg: heartRateNum ?? undefined,
          time: timeIso ?? undefined,
        })
        showToast(`Updated ${trimmed}`)
      } else {
        const timeForSave = timeIso ?? nowTime()
        await db.addWorkout(date, {
          description: trimmed,
          intensity,
          activity_type: activityType || undefined,
          calories_burned: calsBurnedNum ?? undefined,
          duration_min: durationMinNum ?? undefined,
          distance_km: distanceKmNum,
          heart_rate_avg: heartRateNum ?? undefined,
          time: timeForSave,
        })
        showToast(`${INTENSITY_TOAST[intensity]} ${trimmed}`)

        const autoPushEntry = {
          description: trimmed, activity_type: activityType || undefined, date, time: timeForSave,
          duration_min: durationMinNum ?? undefined, calories_burned: calsBurnedNum ?? undefined,
          distance_km: distanceKmNum, heart_rate_avg: heartRateNum ?? undefined,
        }
        if (stravaAutoPushEnabled() && stravaIsConnected() && durationMinNum) {
          pushActivityToStrava(autoPushEntry)
            .then(() => showToast('Pushed to Strava'))
            .catch((err) => showToast('Strava push failed: ' + ((err as Error).message || err)))
        }
        if (ghAutoPushEnabled() && googleHealthIsConnected() && durationMinNum) {
          pushActivityToGoogleHealth(autoPushEntry).catch((e) => console.warn('GH auto-push:', e))
        }
      }
      closeSheet()
    } catch (err) {
      showToast((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={editing ? 'Edit Activity' : 'Log Activity'}>
      <div className="form-field">
        <label className="form-label" htmlFor="w-desc">Activity</label>
        <AutocompleteInput id="w-desc" placeholder="e.g. Morning run" value={desc} suggestions={suggestions} onChange={setDesc} onSelect={handlePickPreset} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="w-date">Date</label>
          <input className="form-input" id="w-date" type="date" value={date} disabled={!!editing} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="w-time">Time</label>
          <input className="form-input" id="w-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
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
        <label className="form-label" htmlFor="w-activity-type">
          Activity type <span style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 400 }}>(auto-detected if blank)</span>
        </label>
        <select className="form-input" id="w-activity-type" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
          <option value="">Auto-detect from name</option>
          {Object.entries(ACTIVITY_TYPE).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="w-calories-burned">Calories burned (optional)</label>
        <input id="w-calories-burned" type="number" className="form-input" inputMode="numeric" placeholder="e.g. 350" min={0} value={calsBurned} onChange={(e) => setCalsBurned(e.target.value)} />
      </div>
      <div className="form-row-2">
        <div className="form-field">
          <label className="form-label" htmlFor="w-duration-min">Duration (min)</label>
          <input id="w-duration-min" type="number" className="form-input" inputMode="numeric" placeholder="e.g. 45" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="w-distance-km">Distance (km)</label>
          <input id="w-distance-km" type="number" className="form-input" inputMode="decimal" placeholder="e.g. 5.2" min={0} step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="w-heart-rate">Avg heart rate (bpm)</label>
        <input id="w-heart-rate" type="number" className="form-input" inputMode="numeric" placeholder="e.g. 145" min={0} value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>{editing ? 'Update Activity' : 'Log Activity'}</button>
    </Sheet>
  )
}

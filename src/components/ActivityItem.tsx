import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { INTENSITY_ICON_NAME, TARGETS, detectActivityType } from '../lib/config'
import { cap, formatTimeToAMPM, type WorkoutEntry } from '../lib/utils'
import { typeIconName, SPORT_TYPE_MAP } from '../lib/icons'
import { db, setWorkoutConflictOverride, dismissWorkoutConflict, reflagWorkoutConflict } from '../lib/db'
import { openEditActivitySheet } from '../lib/sheets'
import { showToast } from '../lib/toast'
import { stravaIsConnected, pushActivityToStrava, deleteActivityFromStrava, syncStrava } from '../lib/strava'
import { googleHealthIsConnected, pushActivityToGoogleHealth, deleteActivityFromGoogleHealth, syncGoogleHealth } from '../lib/google-health'
import { markPushedToStrava, markPushedToGH, clearPushedToStrava, clearPushedToGH, wasPushedToStrava, wasPushedToGH, pushedStravaId, pushedGHId } from '../lib/push-tracker'
import Icon from './Icon'
import EntryMenu from './EntryMenu'

export function ActivityItem({ entry, onChanged, style }: { entry: WorkoutEntry; onChanged: () => void; style?: CSSProperties }) {
  const intensity = INTENSITY_ICON_NAME[entry.intensity || 'medium'] || INTENSITY_ICON_NAME.medium

  const logIconName = entry.activity_type
    ? typeIconName(entry.activity_type)
    : entry.sport_type
      ? typeIconName(SPORT_TYPE_MAP[entry.sport_type] || detectActivityType(entry.description))
      : typeIconName(detectActivityType(entry.description))

  const isStrava = entry.source === 'strava'
  const isFitbit = entry.source === 'fitbit'
  const isGoogleHealth = entry.source === 'google-health' || isFitbit
  const isImported = isStrava || isGoogleHealth
  const inConflict = !!entry.conflictGroupId
  const isDismissed = !!entry.dismissedConflictGroupId
  const conflictSources = entry.conflictSources || []
  const conflictHasStrava = conflictSources.includes('strava')
  const conflictHasGH = conflictSources.some((s) => s === 'google-health' || s === 'fitbit')
  const id = entry.id!
  const pushedToStrava = !isStrava && wasPushedToStrava(id)
  const pushedToGH = !isGoogleHealth && wasPushedToGH(id)

  async function handleDelete() {
    if (!entry.id) return
    await db.deleteWorkout(entry.id)
    onChanged()
  }

  async function handlePushToStrava() {
    if (!entry.duration_min) { showToast('Set a duration before pushing to Strava'); return }
    showToast('Pushing to Strava…')
    try {
      const { id: remoteId } = await pushActivityToStrava(entry)
      markPushedToStrava(id, String(remoteId))
      showToast('Pushed to Strava')
      onChanged()
      syncStrava().catch((e) => console.warn('Strava sync:', e))
    } catch (err) { showToast((err as Error).message) }
  }

  async function handlePushToGoogleHealth() {
    if (!entry.duration_min) { showToast('Set a duration before pushing to Google Health'); return }
    showToast('Pushing to Google Health…')
    try {
      const remoteId = await pushActivityToGoogleHealth(entry)
      markPushedToGH(id, remoteId!)
      showToast('Pushed to Google Health')
      onChanged()
      syncGoogleHealth().catch((e) => console.warn('GH sync:', e))
    } catch (err) { showToast((err as Error).message) }
  }

  async function handleDeleteFromStrava() {
    if (!confirm('Delete this activity from Strava and remove it locally?')) return
    if (!entry.external_id) { showToast('No Strava activity ID'); return }
    showToast('Deleting from Strava…')
    try {
      await deleteActivityFromStrava(entry.external_id)
      await db.deleteWorkout(id)
      showToast('Deleted from Strava')
      onChanged()
    } catch (err) { showToast((err as Error).message) }
  }

  async function handleDeleteFromGH() {
    if (!confirm('Delete this activity from Google Health and remove it locally?')) return
    if (!entry.external_id) { showToast('No Google Health data point ID'); return }
    showToast('Deleting from Google Health…')
    try {
      await deleteActivityFromGoogleHealth(entry.external_id)
      await db.deleteWorkout(id)
      showToast('Deleted from Google Health')
      onChanged()
    } catch (err) { showToast((err as Error).message) }
  }

  async function handleUnlinkFromStrava() {
    if (!confirm('Remove this activity from Strava? It will be kept locally.')) return
    const remoteId = pushedStravaId(id)
    if (!remoteId) { showToast('No Strava activity ID'); return }
    showToast('Removing from Strava…')
    try {
      await deleteActivityFromStrava(remoteId)
      clearPushedToStrava(id)
      showToast('Removed from Strava (kept locally)')
      onChanged()
    } catch (err) { showToast((err as Error).message) }
  }

  async function handleUnlinkFromGH() {
    if (!confirm('Remove this activity from Google Health? It will be kept locally.')) return
    const remoteId = pushedGHId(id)
    if (!remoteId) { showToast('No Google Health data point ID'); return }
    showToast('Removing from Google Health…')
    try {
      await deleteActivityFromGoogleHealth(remoteId)
      clearPushedToGH(id)
      showToast('Removed from Google Health (kept locally)')
      onChanged()
    } catch (err) { showToast((err as Error).message) }
  }

  function handleActivateConflict() {
    if (!entry.conflictGroupId) return
    setWorkoutConflictOverride(entry.conflictGroupId, entry.source || 'manual', entry.id)
    db.bust()
    showToast('Selected activity will count')
    onChanged()
  }

  function handleUnflagConflict() {
    if (!entry.conflictGroupId) return
    dismissWorkoutConflict(entry.conflictGroupId)
    db.bust()
    showToast('Marked as not a duplicate')
    onChanged()
  }

  function handleReflagConflict() {
    if (!entry.dismissedConflictGroupId) return
    reflagWorkoutConflict(entry.dismissedConflictGroupId)
    db.bust()
    showToast('Flagged as duplicate again')
    onChanged()
  }

  const active = entry.calories_burned ? Math.round(entry.calories_burned) : null
  const total = active && entry.duration_min
    ? active + Math.round((TARGETS.calories.bmr || 1800) / 1440 * entry.duration_min)
    : null

  const canActivateConflict = inConflict && entry.isDuplicate
  const canPushStrava = !isStrava && !conflictHasStrava && stravaIsConnected()
  const canPushGH = !isGoogleHealth && !conflictHasGH && googleHealthIsConnected()
  const canDeleteFromStrava = isStrava && stravaIsConnected()
  const canDeleteFromGH = isGoogleHealth && !isFitbit && googleHealthIsConnected()
  const canUnlinkStrava = pushedToStrava && !isStrava && !isGoogleHealth && !conflictHasStrava && stravaIsConnected()
  const canUnlinkGH = pushedToGH && !isGoogleHealth && !isStrava && googleHealthIsConnected()
  const hasMenu = !isImported || inConflict || isDismissed || canPushStrava || canPushGH || canDeleteFromStrava || canDeleteFromGH || canUnlinkStrava || canUnlinkGH

  return (
    <div className="log-item" style={style}>
      <div className="log-icon"><Icon name={logIconName} size={16} /></div>
      <div className="log-body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <div className="log-desc">{entry.description || '—'}</div>
          {entry.time && <div style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{formatTimeToAMPM(entry.time)}</div>}
        </div>
        <div className="log-tags">
          <span className={`tag intensity-${entry.intensity}`}>
            <Icon name={intensity.name} size={11} weight={intensity.weight} /> {cap(entry.intensity) || ''}
          </span>
          {!!entry.duration_min && <span className="tag"><Icon name="schedule" size={10} style={{ verticalAlign: -1 }} /> {entry.duration_min} min</span>}
          {!!entry.distance_km && <span className="tag"><Icon name="location_on" size={10} style={{ verticalAlign: -1 }} /> {entry.distance_km} km</span>}
          {!!entry.heart_rate_avg && (
            <span className="tag"><Icon name="favorite" size={10} style={{ verticalAlign: -1 }} /> {entry.heart_rate_avg} bpm</span>
          )}
          {isStrava && (
            <a className="tag tag-strava" href={`https://www.strava.com/activities/${entry.external_id}`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>Strava ↗</a>
          )}
          {entry.source === 'fitbit' && <span className="tag tag-google-health">Fitbit</span>}
          {isGoogleHealth && entry.source !== 'fitbit' && <span className="tag tag-google-health">Google Health</span>}
        </div>
      </div>
      {active !== null && (
        <div className="log-right">
          <div className="log-cal">{active}</div>
          {total !== null && <div className="log-cal-active">{total}</div>}
          <div className="log-cal-unit">kcal</div>
        </div>
      )}
      {hasMenu && (
        <EntryMenu>
          {!isImported && <button onClick={() => openEditActivitySheet(entry)}>Edit</button>}
          {canActivateConflict && <button onClick={handleActivateConflict}>Count this instead</button>}
          {inConflict && <button onClick={handleUnflagConflict}>Not a duplicate</button>}
          {isDismissed && <button onClick={handleReflagConflict}>Flag as duplicate</button>}
          {canPushStrava && <button onClick={handlePushToStrava}>Push to Strava</button>}
          {canPushGH && <button onClick={handlePushToGoogleHealth}>Push to Google Health</button>}
          {canDeleteFromStrava && <button className="danger" onClick={handleDeleteFromStrava}>Delete from Strava</button>}
          {canDeleteFromGH && <button className="danger" onClick={handleDeleteFromGH}>Delete from Google Health</button>}
          {canUnlinkStrava && <button className="danger" onClick={handleUnlinkFromStrava}>Remove from Strava</button>}
          {canUnlinkGH && <button className="danger" onClick={handleUnlinkFromGH}>Remove from Google Health</button>}
          {!isImported && <button className="danger" onClick={handleDelete}>Delete</button>}
        </EntryMenu>
      )}
    </div>
  )
}

export function groupActivitiesByConflict(activities: WorkoutEntry[]) {
  type Tagged = WorkoutEntry & { conflictGroupId?: string; dismissedConflictGroupId?: string; isDuplicate?: boolean }
  const groups = new Map<string, Tagged[]>()
  for (const entry of activities as Tagged[]) {
    if (entry.conflictGroupId && !entry.dismissedConflictGroupId) {
      if (!groups.has(entry.conflictGroupId)) groups.set(entry.conflictGroupId, [])
      groups.get(entry.conflictGroupId)!.push(entry)
    }
  }

  const result: ({ type: 'stack'; entries: Tagged[]; groupId: string } | { type: 'single'; entry: Tagged })[] = []
  const seen = new Set<string>()
  for (const entry of activities as Tagged[]) {
    if (seen.has(entry.id!)) continue
    seen.add(entry.id!)

    if (entry.conflictGroupId && !entry.dismissedConflictGroupId) {
      const gid = entry.conflictGroupId
      const group = groups.get(gid)!
      const firstInGroup = group[0]
      if (firstInGroup.id !== entry.id) continue
      const sorted = [...group].sort((a, b) => (a.isDuplicate ? 1 : 0) - (b.isDuplicate ? 1 : 0))
      result.push({ type: 'stack', entries: sorted, groupId: gid })
    } else {
      result.push({ type: 'single', entry })
    }
  }
  return result
}

// The reveal animates `grid-template-rows` from 0fr to 1fr, which tracks the
// duplicate cards' real height (no fixed-height guess, unlike a max-height
// transition). The inner div is the actual clip boundary: collapsed (or
// mid-transition) it stays overflow:hidden; once the grid transition settles
// we flip it to visible so a duplicate's three-dot dropdown isn't clipped.
export function ActivityStack({ entries, expanded, onToggle, onChanged }: { entries: WorkoutEntry[]; expanded: boolean; onToggle: () => void; onChanged: () => void }) {
  const [active, ...dupes] = entries
  const belowRef = useRef<HTMLDivElement>(null)
  const [settled, setSettled] = useState(expanded)

  useEffect(() => {
    if (!expanded) { setSettled(false); return }
    const el = belowRef.current
    if (!el) return
    const onEnd = (e: TransitionEvent) => { if (e.propertyName === 'grid-template-rows') setSettled(true) }
    el.addEventListener('transitionend', onEnd)
    return () => el.removeEventListener('transitionend', onEnd)
  }, [expanded])

  return (
    <div
      className={`conflict-stack${expanded ? ' conflict-stack--expanded' : ''}`}
      onClick={onToggle}
      data-count={Math.min(entries.length, 3)}
    >
      <ActivityItem entry={active} onChanged={onChanged} />
      <div ref={belowRef} className="conflict-stack-below">
        <div className="conflict-stack-below-inner" style={{ overflow: settled ? 'visible' : 'hidden' }}>
          {dupes.map((e, i) => (
            <ActivityItem key={e.id} entry={e} onChanged={onChanged} style={{ '--dupe-delay': `${(i * 0.06).toFixed(2)}s` } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  )
}

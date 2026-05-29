<script>
  import { openSheetId, workoutDraft } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { state } from '../../lib/state.js'
  import { closeSheets, showToast } from '../../lib/ui.js'
  import { dateStr, nowTime } from '../../lib/utils.js'
  import { renderActive } from '../../lib/app-logic.js'
  import { stravaAutoPushEnabled, stravaIsConnected, pushActivityToStrava } from '../../lib/strava.js'
  import { ghAutoPushEnabled, googleHealthIsConnected, pushActivityToGoogleHealth } from '../../lib/google-health.js'
  import Sheet from './Sheet.svelte'

  const INTENSITIES = [
    { key: 'low', label: 'Low', icon: 'signal_cellular_alt_1_bar' },
    { key: 'medium', label: 'Medium', icon: 'signal_cellular_alt' },
    { key: 'high', label: 'High', icon: 'trending_up' },
  ]

  let desc = ''
  let date = ''
  let time = ''
  let intensity = 'medium'
  let activityType = ''
  let calsBurned = ''
  let durationMin = ''
  let distanceKm = ''
  let heartRate = ''
  let editId = null
  let banner = ''
  let claudeDraft = false

  let acItems = []
  let acOpen = false
  let descEl
  let saving = false

  // Sync from workoutDraft store when sheet opens
  $: if ($openSheetId === 'intensity-sheet') {
    const d = $workoutDraft
    desc = d.desc || ''
    date = d.date || dateStr()
    time = d.time || ''
    intensity = d.intensity || 'medium'
    activityType = d.activityType || ''
    calsBurned = d.calsBurned || ''
    durationMin = d.durationMin || ''
    distanceKm = d.distanceKm || ''
    heartRate = d.heartRate || ''
    editId = d.editId || null
    banner = d.banner || ''
    claudeDraft = d.claudeDraft || false
    acOpen = false
    acItems = []
    setTimeout(() => descEl?.focus(), 360)
  }

  async function onDescInput() {
    if (!state.workoutPresetsCache) {
      try { state.workoutPresetsCache = await db.loadWorkoutPresets() } catch (_) { return }
    }
    updateAutocomplete(desc)
  }

  function updateAutocomplete(query) {
    const presets = state.workoutPresetsCache || []
    const q = query.toLowerCase().trim()
    if (!q || !presets.length) { acOpen = false; acItems = []; return }
    const matches = presets.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5)
    if (!matches.length) { acOpen = false; acItems = []; return }
    acItems = matches
    acOpen = true
  }

  function selectPreset(p) {
    desc = p.name || ''
    if (p.calories_burned) calsBurned = p.calories_burned
    if (p.duration_min) durationMin = p.duration_min
    if (p.distance_km) distanceKm = p.distance_km
    if (p.heart_rate_avg) heartRate = p.heart_rate_avg
    if (p.activity_type) activityType = p.activity_type
    if (p.intensity) intensity = p.intensity
    acOpen = false
    acItems = []
  }

  async function save() {
    if (saving) return
    if (!desc.trim()) { descEl?.focus(); return }
    saving = true
    const dateVal = date || dateStr()
    const timeVal = time || null
    const fromClaudeDraft = claudeDraft || state.pendingClaudeDraft?.type === 'workout'
    closeSheets()
    try {
      if (editId) {
        await db.updateWorkout(editId, {
          description: desc.trim(),
          intensity,
          activity_type: activityType || null,
          calories_burned: Number(calsBurned) || null,
          duration_min: Number(durationMin) || null,
          distance_km: Number(distanceKm) || null,
          heart_rate_avg: Number(heartRate) || null,
          time: timeVal ? `${dateVal}T${timeVal}:00` : null,
        })
        showToast(`✅ Updated ${desc.trim()}`)
      } else {
        const timeIso = timeVal ? `${dateVal}T${timeVal}:00` : nowTime()
        const durMin = Number(durationMin) || null
        await db.addWorkout(dateVal, {
          description: desc.trim(),
          intensity,
          activity_type: activityType || null,
          calories_burned: Number(calsBurned) || null,
          duration_min: durMin,
          distance_km: Number(distanceKm) || null,
          heart_rate_avg: Number(heartRate) || null,
          time: timeIso,
        })
        showToast(fromClaudeDraft
          ? `✅ Confirmed ${desc.trim()}`
          : `${{ low: '😴', medium: '💪', high: '🔥' }[intensity]} Logged ${desc.trim()}`)

        const autoPushEntry = {
          description: desc.trim(),
          activity_type: activityType || null,
          date: dateVal,
          time: timeIso,
          duration_min: durMin,
          calories_burned: Number(calsBurned) || null,
          distance_km: Number(distanceKm) || null,
          heart_rate_avg: Number(heartRate) || null,
        }
        if (stravaAutoPushEnabled() && stravaIsConnected() && durMin) {
          pushActivityToStrava(autoPushEntry)
            .then(() => showToast('✅ Pushed to Strava'))
            .catch(err => showToast('⚠️ Strava push failed: ' + (err.message || err)))
        }
        if (ghAutoPushEnabled() && googleHealthIsConnected() && durMin) {
          pushActivityToGoogleHealth(autoPushEntry).catch(e => console.warn('GH auto-push:', e))
        }
      }
      await renderActive()
    } catch (err) {
      showToast('❌ ' + (err.message || 'Save failed'))
    } finally {
      saving = false
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<Sheet id="intensity-sheet">
  <svelte:fragment slot="title">{editId ? 'Edit Activity' : 'Log Activity'}</svelte:fragment>

  {#if banner}
    <div class="preset-match-banner">{banner}</div>
  {/if}

  <div class="form-field autocomplete-wrap">
    <label class="form-label" for="ws-desc">Activity</label>
    <input
      class="form-input"
      id="ws-desc"
      type="text"
      placeholder="e.g. Morning run"
      autocomplete="off"
      bind:value={desc}
      bind:this={descEl}
      on:input={onDescInput}
    />
    {#if acOpen && acItems.length}
      <div class="autocomplete-list open">
        {#each acItems as item}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="autocomplete-item" on:click={() => selectPreset(item)}>
            <span class="autocomplete-item-name">{item.name}</span>
            {#if item.calories_burned}
              <span class="autocomplete-item-cal">{Math.round(item.calories_burned)} kcal</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div style="display:flex;gap:8px">
    <div class="form-field" style="flex:1">
      <label class="form-label" for="ws-date">Date</label>
      <input class="form-input" id="ws-date" type="date" bind:value={date} />
    </div>
    <div class="form-field" style="flex:1">
      <label class="form-label" for="ws-time">Time</label>
      <input class="form-input" id="ws-time" type="time" bind:value={time} />
    </div>
  </div>

  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Intensity</label>
    <div class="intensity-btns">
      {#each INTENSITIES as i}
        <button
          class="intensity-btn"
          class:active={intensity === i.key}
          type="button"
          on:click={() => intensity = i.key}
        >
          <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">{i.icon}</span>{i.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="form-field">
    <label class="form-label" for="ws-activity-type">Activity type <span style="font-size:11px;color:var(--tx3);font-weight:400">(auto-detected if blank)</span></label>
    <select class="form-input" id="ws-activity-type" bind:value={activityType}>
      <option value="">Auto-detect from name</option>
      <option value="run">Running</option>
      <option value="cycle">Cycling</option>
      <option value="swim">Swimming</option>
      <option value="walk">Walking</option>
      <option value="lift">Lifting / Gym</option>
      <option value="box">Martial arts / Combat</option>
      <option value="hiit">HIIT / Cardio</option>
      <option value="yoga">Yoga / Pilates</option>
      <option value="tennis">Racquet sport</option>
      <option value="climb">Climbing</option>
      <option value="row">Rowing / Kayak</option>
      <option value="ball">Ball sport</option>
    </select>
  </div>

  <div class="form-field">
    <label class="form-label" for="ws-calories-burned">Calories burned (optional)</label>
    <input id="ws-calories-burned" type="number" class="form-input" inputmode="numeric" placeholder="e.g. 350" min="0" bind:value={calsBurned} />
  </div>

  <div class="form-row-2">
    <div class="form-field">
      <label class="form-label" for="ws-duration-min">Duration (min)</label>
      <input id="ws-duration-min" type="number" class="form-input" inputmode="numeric" placeholder="e.g. 45" min="0" bind:value={durationMin} />
    </div>
    <div class="form-field">
      <label class="form-label" for="ws-distance-km">Distance (km)</label>
      <input id="ws-distance-km" type="number" class="form-input" inputmode="decimal" placeholder="e.g. 5.2" min="0" step="0.1" bind:value={distanceKm} />
    </div>
  </div>

  <div class="form-field">
    <label class="form-label" for="ws-heart-rate">Avg heart rate (bpm)</label>
    <input id="ws-heart-rate" type="number" class="form-input" inputmode="numeric" placeholder="e.g. 145" min="0" bind:value={heartRate} />
  </div>

  <button class="btn-primary" disabled={saving} on:click={save}>{editId ? 'Update Activity' : 'Log Activity'}</button>
</Sheet>

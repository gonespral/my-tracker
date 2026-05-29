<script>
  import { openSheetId } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { state } from '../../lib/state.js'
  import { showToast } from '../../lib/ui.js'
  import { renderSettings } from '../../lib/tabs/settings.js'
  import Sheet from './Sheet.svelte'

  const INTENSITIES = [
    { key: 'low', label: 'Low', icon: 'signal_cellular_alt_1_bar' },
    { key: 'medium', label: 'Medium', icon: 'signal_cellular_alt' },
    { key: 'high', label: 'High', icon: 'trending_up' },
  ]

  let name = ''
  let intensity = 'medium'
  let calsBurned = ''
  let editId = null

  $: if ($openSheetId === 'workout-preset-sheet') {
    editId = state.pendingEditWorkoutPresetId || null
    const w = editId ? (state.workoutPresetsCache || []).find(x => x.id === editId) : null
    name = w?.name || ''
    intensity = w?.intensity || 'medium'
    calsBurned = w?.calories_burned || ''
  }

  async function save() {
    if (!name.trim()) { document.getElementById('wps-svelte-name')?.focus(); return }
    const entry = {
      name: name.trim(),
      intensity,
      calories_burned: Number(calsBurned) || null,
    }
    const id = editId
    state.pendingEditWorkoutPresetId = null
    try {
      if (id) { await db.updateWorkoutPreset(id, entry); showToast('✅ Workout updated') }
      else { await db.addWorkoutPreset(entry); showToast('✅ Workout saved') }
      state.workoutPresetsCache = null
      await renderSettings()
    } catch (err) { showToast('❌ ' + err.message) }
  }
</script>

<Sheet id="workout-preset-sheet" returnToId="settings-sheet">
  <svelte:fragment slot="title">{editId ? 'Edit Activity' : 'New Activity'}</svelte:fragment>

  <div class="form-field">
    <label class="form-label" for="wps-svelte-name">Name</label>
    <input class="form-input" id="wps-svelte-name" type="text" placeholder="e.g. Morning swim" bind:value={name} />
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
    <label class="form-label" for="wps-svelte-calories-burned">Calories burned (optional)</label>
    <input class="form-input" id="wps-svelte-calories-burned" type="number" inputmode="numeric" placeholder="e.g. 350" min="0" bind:value={calsBurned} />
  </div>

  <button class="btn-primary" on:click={save}>{editId ? 'Update Activity' : 'Save Activity'}</button>
</Sheet>

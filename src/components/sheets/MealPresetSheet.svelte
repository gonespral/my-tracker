<script>
  import { openSheetId } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { state } from '../../lib/state.js'
  import { showToast } from '../../lib/ui.js'
  import { renderSettings } from '../../lib/tabs/settings.js'
  import Sheet from './Sheet.svelte'

  const MEALS = ['breakfast', 'lunch', 'snack', 'dinner']

  let name = ''
  let cal = ''
  let pro = ''
  let car = ''
  let fat = ''
  let meal = 'snack'
  let editId = null

  $: if ($openSheetId === 'meal-preset-sheet') {
    editId = state.pendingEditPresetId || null
    const m = editId ? (state.mealsCache || []).find(x => x.id === editId) : null
    name = m?.name || ''
    cal = m?.calories || ''
    pro = m?.protein || ''
    car = m?.carbs || ''
    fat = m?.fat || ''
    meal = m?.meal || 'snack'
  }

  async function save() {
    if (!name.trim()) { document.getElementById('mps-name')?.focus(); return }
    const entry = {
      name: name.trim(),
      calories: Number(cal) || 0,
      protein: Number(pro) || 0,
      carbs: Number(car) || 0,
      fat: Number(fat) || 0,
      meal,
    }
    const id = editId
    // Sheet will close via returnToId="settings-sheet" but we handle the data here
    try {
      if (id) { await db.updateMeal(id, entry); showToast('✅ Meal updated') }
      else { await db.addMeal(entry); showToast('✅ Meal saved') }
      state.mealsCache = null
      await renderSettings()
    } catch (err) { showToast('❌ ' + err.message) }
  }
</script>

<Sheet id="meal-preset-sheet" returnToId="settings-sheet">
  <svelte:fragment slot="title">{editId ? 'Edit Meal' : 'New Meal'}</svelte:fragment>

  <div class="form-field">
    <label class="form-label" for="mps-name">Name</label>
    <input class="form-input" id="mps-name" type="text" placeholder="e.g. Oats with protein" bind:value={name} />
  </div>

  <div class="form-field">
    <label class="form-label" for="mps-cal">Calories (kcal)</label>
    <input class="form-input" id="mps-cal" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={cal} />
  </div>

  <div class="form-macros">
    <div class="form-field">
      <label class="form-label" for="mps-pro">Protein (g)</label>
      <input class="form-input" id="mps-pro" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={pro} />
    </div>
    <div class="form-field">
      <label class="form-label" for="mps-car">Carbs (g)</label>
      <input class="form-input" id="mps-car" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={car} />
    </div>
    <div class="form-field">
      <label class="form-label" for="mps-fat">Fat (g)</label>
      <input class="form-input" id="mps-fat" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={fat} />
    </div>
  </div>

  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Default meal</label>
    <div class="meal-btns">
      {#each MEALS as m}
        <button
          class="meal-btn"
          class:active={meal === m}
          type="button"
          on:click={() => meal = m}
        >{m.charAt(0).toUpperCase() + m.slice(1)}</button>
      {/each}
    </div>
  </div>

  <button class="btn-primary" on:click={save}>{editId ? 'Update Meal' : 'Save Meal'}</button>
</Sheet>

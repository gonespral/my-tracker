<script>
  import { onMount } from 'svelte'
  import { openSheetId, foodDraft } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { state } from '../../lib/state.js'
  import { closeSheets, showToast } from '../../lib/ui.js'
  import { dateStr } from '../../lib/utils.js'
  import { renderActive } from '../../lib/app-logic.js'
  import Sheet from './Sheet.svelte'

  const MEALS = ['breakfast', 'lunch', 'snack', 'dinner']

  let meal = 'snack'
  let date = ''
  let desc = ''
  let cal = ''
  let pro = ''
  let car = ''
  let fat = ''
  let editId = null
  let banner = ''

  let acItems = []
  let acOpen = false
  let descEl

  // Sync from foodDraft store when sheet opens
  $: if ($openSheetId === 'food-sheet') {
    const d = $foodDraft
    meal = d.meal || 'snack'
    date = d.date || dateStr()
    desc = d.desc || ''
    cal = d.cal || ''
    pro = d.pro || ''
    car = d.car || ''
    fat = d.fat || ''
    editId = d.editId || null
    banner = d.banner || ''
    acOpen = false
    acItems = []
    // Focus desc after transition
    setTimeout(() => descEl?.focus(), 360)
  }

  async function onDescInput() {
    if (!state.mealsCache) {
      try { state.mealsCache = await db.loadMeals() } catch (_) { return }
    }
    updateAutocomplete(desc)
  }

  function updateAutocomplete(query) {
    const meals = state.mealsCache || []
    const q = query.toLowerCase().trim()
    if (!q || !meals.length) { acOpen = false; acItems = []; return }
    const matches = meals.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5)
    if (!matches.length) { acOpen = false; acItems = []; return }
    acItems = matches
    acOpen = true
  }

  function selectPreset(m) {
    desc = m.name || ''
    cal = m.calories || ''
    pro = m.protein || ''
    car = m.carbs || ''
    fat = m.fat || ''
    if (m.meal) meal = m.meal
    acOpen = false
    acItems = []
  }

  async function save() {
    if (!desc.trim()) { descEl?.focus(); return }
    const entry = {
      description: desc.trim(),
      calories: Number(cal) || 0,
      protein: Number(pro) || 0,
      carbs: Number(car) || 0,
      fat: Number(fat) || 0,
      meal,
    }
    const fromClaudeDraft = state.pendingClaudeDraft?.type === 'food'
    const dateVal = date || dateStr()
    closeSheets()
    try {
      if (editId) {
        await db.updateFood(editId, entry)
        showToast(`✅ Updated ${desc.trim()}`)
      } else {
        await db.addFood(dateVal, entry)
        showToast(fromClaudeDraft ? `✅ Confirmed ${desc.trim()}` : `🍽️ Logged ${desc.trim()}`)
      }
      await renderActive()
    } catch (err) {
      showToast('❌ ' + (err.message || 'Save failed'))
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<Sheet id="food-sheet">
  <svelte:fragment slot="title">{editId ? 'Edit Food' : 'Log Food'}</svelte:fragment>

  {#if banner}
    <div class="preset-match-banner">{banner}</div>
  {/if}

  <div class="form-field">
    <label class="form-label" for="fs-date">Date</label>
    <input class="form-input" id="fs-date" type="date" bind:value={date} disabled={!!editId} />
  </div>

  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Meal</label>
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

  <div class="form-field autocomplete-wrap">
    <label class="form-label" for="fs-desc">Description</label>
    <input
      class="form-input"
      id="fs-desc"
      type="text"
      placeholder="e.g. Pasta pesto + 2 eggs"
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
            <span class="autocomplete-item-cal">{Math.round(item.calories)} kcal</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="form-field">
    <label class="form-label" for="fs-cal">Calories (kcal)</label>
    <input class="form-input" id="fs-cal" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={cal} />
  </div>

  <div class="form-macros">
    <div class="form-field">
      <label class="form-label" for="fs-pro">Protein (g)</label>
      <input class="form-input" id="fs-pro" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={pro} />
    </div>
    <div class="form-field">
      <label class="form-label" for="fs-car">Carbs (g)</label>
      <input class="form-input" id="fs-car" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={car} />
    </div>
    <div class="form-field">
      <label class="form-label" for="fs-fat">Fat (g)</label>
      <input class="form-input" id="fs-fat" type="number" inputmode="numeric" placeholder="0" min="0" bind:value={fat} />
    </div>
  </div>

  <button class="btn-primary" on:click={save}>{editId ? 'Update Food' : 'Log Food'}</button>
</Sheet>

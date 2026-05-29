<script>
  import { openSheetId } from '../../stores.js'
  import { db } from '../../lib/db.js'
  import { state } from '../../lib/state.js'
  import { closeSheets, showToast } from '../../lib/ui.js'
  import { dateStr, nowTime } from '../../lib/utils.js'
  import { renderActive } from '../../lib/app-logic.js'
  import Sheet from './Sheet.svelte'

  let kg = ''
  let editDate = ''

  $: if ($openSheetId === 'weight-edit-sheet') {
    kg = ''
    editDate = state.pendingEditWeightDate || dateStr()
    // If editing, pre-fill kg from dbCache
    if (state.pendingEditWeightDate) {
      const data = state.dbCache
      if (data) {
        const entry = (data.weights || []).find(w => w.date === state.pendingEditWeightDate)
        if (entry) kg = entry.kg
      }
    }
  }

  async function save() {
    const parsed = parseFloat(kg)
    if (!parsed || isNaN(parsed)) return
    const date = editDate || dateStr()
    state.pendingEditWeightDate = null
    closeSheets()
    try {
      await db.upsertWeight({ kg: parsed, date, time: nowTime() })
      showToast('✅ Weight logged')
      await renderActive()
    } catch (err) {
      showToast('❌ ' + err.message)
    }
  }
</script>

<Sheet id="weight-edit-sheet">
  <svelte:fragment slot="title">{state.pendingEditWeightDate ? 'Edit weight' : 'Log weight'}</svelte:fragment>

  <div class="form-field">
    <label class="form-label" for="wt-kg">Weight (kg)</label>
    <input id="wt-kg" type="number" class="form-input" inputmode="decimal" step="0.1" placeholder="e.g. 73.5" bind:value={kg} />
  </div>

  <button class="btn-primary" on:click={save}>Save</button>
</Sheet>

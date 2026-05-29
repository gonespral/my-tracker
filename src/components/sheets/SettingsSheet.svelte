<script>
  import { onMount } from 'svelte'
  import { openSheetId } from '../../stores.js'
  import { closeSheets, bindSnapDrag } from '../../lib/ui.js'
  import { renderSettings } from '../../lib/tabs/settings.js'
  import { APP_VERSION } from '../../lib/version.js'

  let el
  let handleEl

  $: if ($openSheetId === 'settings-sheet') {
    renderSettings().catch(e => console.error('Settings render error:', e))
  }

  onMount(() => {
    if (!handleEl || !el) return
    bindSnapDrag(handleEl, {
      targetEl: el,
      states: ['open', 'closed'],
      getState: () => $openSheetId === 'settings-sheet' ? 'open' : 'closed',
      setState: next => { if (next === 'closed') closeSheets() },
    })
  })
</script>

<div
  class="sheet sheet-tall"
  class:open={$openSheetId === 'settings-sheet'}
  id="settings-sheet"
  style="padding-bottom:0"
  bind:this={el}
>
  <div class="sheet-handle" bind:this={handleEl}></div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div class="sheet-title" style="margin:0;display:flex;align-items:baseline;gap:8px">
      <span>Settings</span>
      <span id="settings-version" class="settings-version" aria-label="App version">{APP_VERSION}</span>
    </div>
    <button class="chat-close-btn" style="font-size:18px" on:click={closeSheets}>
      <span class="material-symbols-outlined" style="font-size:18px">close</span>
    </button>
  </div>
  <div id="settings-content" style="flex:1;overflow-y:auto;min-height:0;margin:0 -20px;padding:0 20px calc(20px + var(--safe-bot))"></div>
</div>

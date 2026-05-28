<script>
  import { onMount } from 'svelte'
  import { openSheetId } from '../../stores.js'
  import { closeSheets, closeSheet, openSheet, bindSnapDrag } from '../../lib/ui.js'

  export let id
  export let title = ''
  export let tall = false
  export let formStyle = true
  export let returnToId = null   // if set, closing snaps back to this sheet id

  $: open = $openSheetId === id

  let el
  let handleEl

  onMount(() => {
    if (!handleEl || !el) return
    bindSnapDrag(handleEl, {
      targetEl: el,
      states: ['open', 'closed'],
      getState: () => $openSheetId === id ? 'open' : 'closed',
      setState: next => {
        if (next === 'closed') {
          if (returnToId) { closeSheet(id); openSheet(returnToId) }
          else closeSheets()
        }
      },
    })
  })
</script>

<div
  class="sheet"
  class:open
  class:sheet-tall={tall}
  class:sheet-form={formStyle && !tall}
  bind:this={el}
  style={tall ? 'padding-bottom:0' : ''}
>
  <div class="sheet-handle" bind:this={handleEl}></div>
  {#if title}
    <div class="sheet-title"><slot name="title">{title}</slot></div>
  {/if}
  <slot />
</div>

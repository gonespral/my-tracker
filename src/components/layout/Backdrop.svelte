<script>
  import { openSheetId } from '../../stores.js'
  import { closeSheet, closeSheets, openSheet } from '../../lib/ui.js'
  import { collapseChatPanel, hideChatPanel } from '../../lib/ai.js'
  import { get } from 'svelte/store'

  $: backdropOpen = $openSheetId !== null

  function handleClick() {
    const presetOpen = ['meal-preset-sheet', 'workout-preset-sheet']
      .find(id => get(openSheetId) === id)
    if (presetOpen) {
      closeSheet(presetOpen)
      openSheet('settings-sheet')
    } else {
      closeSheets()
      const chatPanel = document.getElementById('chat-panel')
      if (chatPanel?.classList.contains('expanded')) collapseChatPanel()
      else if (chatPanel?.classList.contains('peek')) hideChatPanel()
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div class="backdrop" id="backdrop" role="presentation" class:open={backdropOpen} on:click={handleClick}></div>

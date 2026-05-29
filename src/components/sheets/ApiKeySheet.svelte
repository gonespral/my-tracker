<script>
  import { closeSheets, showToast } from '../../lib/ui.js'
  import Sheet from './Sheet.svelte'

  let key = ''

  function save() {
    if (!key.trim()) return
    localStorage.setItem('tracker-anthropic-key', key.trim())
    closeSheets()
    showToast('✅ API key saved')
  }
</script>

<Sheet id="apikey-sheet">
  <svelte:fragment slot="title">Set up Claude AI</svelte:fragment>

  <p class="setup-note">
    Paste your <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic API key</a>.
    Stored locally — never sent anywhere except Anthropic's API.
  </p>

  <div class="form-field">
    <label class="form-label" for="apikey-svelte-input">API key</label>
    <input class="form-input" id="apikey-svelte-input" type="password" placeholder="sk-ant-..." autocomplete="off" bind:value={key} />
  </div>

  <button class="btn-primary" on:click={save}>Save</button>
</Sheet>

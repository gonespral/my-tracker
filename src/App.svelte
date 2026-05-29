<script>
  import { onMount } from 'svelte'
  import { currentUser, openSheetId, activeTab } from './stores.js'
  import { initAuth, switchTab } from './lib/app-logic.js'
  import Toast from './components/layout/Toast.svelte'
  import Backdrop from './components/layout/Backdrop.svelte'
  import Today from './components/tabs/Today.svelte'
  import Nutrition from './components/tabs/Nutrition.svelte'
  import Workouts from './components/tabs/Workouts.svelte'
  import FoodSheet from './components/sheets/FoodSheet.svelte'
  import WorkoutSheet from './components/sheets/WorkoutSheet.svelte'
  import WeightSheet from './components/sheets/WeightSheet.svelte'
  import MealPresetSheet from './components/sheets/MealPresetSheet.svelte'
  import WorkoutPresetSheet from './components/sheets/WorkoutPresetSheet.svelte'
  import ApiKeySheet from './components/sheets/ApiKeySheet.svelte'
  import SettingsSheet from './components/sheets/SettingsSheet.svelte'

  let authReady = false

  onMount(async () => {
    await initAuth()
    authReady = true
  })
</script>

<!-- ── Top bar ─────────────────────────────────────────────── -->
<header class="top-bar">
  <div class="top-bar-inner">
    <span class="top-bar-title">
      <img src="brand/svg/logo-mono-light.svg" alt="MyTracker" class="app-icon app-icon-light" />
      <img src="brand/svg/logo-mono-dark.svg" alt="MyTracker" class="app-icon app-icon-dark" />
      MyTracker
      <a href="https://github.com/gonespral/my-tracker" target="_blank" class="github-repo-link" aria-label="GitHub Repository">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
        </svg>
      </a>
    </span>
    <div id="sync-status" hidden aria-live="polite">
      <span class="sync-dot"></span>
      <span class="sync-label"></span>
    </div>
    <div class="top-bar-actions">
      <button id="demo-btn" class="icon-btn" title="Exit Demo Mode" style="display:none; color: var(--warn); background: var(--warn-soft); border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.5px; border: 1px solid var(--warn);">
        DEMO
      </button>
      <button id="refresh-btn" class="icon-btn" title="Sync all" aria-label="Sync all">
        <span class="material-symbols-outlined" style="font-size:18px">sync</span>
      </button>
      <button id="theme-toggle" class="icon-btn" title="Toggle dark mode" aria-label="Toggle dark mode">
        <span class="material-symbols-outlined icon-sun" style="font-size:18px">light_mode</span>
        <span class="material-symbols-outlined icon-moon" style="font-size:18px">dark_mode</span>
      </button>
      <button id="apikey-btn" class="icon-btn" title="Settings" aria-label="Settings">
        <span class="material-symbols-outlined" style="font-size:18px">settings</span>
      </button>
    </div>
  </div>
  <div class="top-bar-tabs">
    <button class="tab" class:active={$activeTab === 'today'} on:click={() => switchTab('today')}>Today</button>
    <button class="tab" class:active={$activeTab === 'nutrition'} on:click={() => switchTab('nutrition')}>Nutrition</button>
    <button class="tab" class:active={$activeTab === 'workouts'} on:click={() => switchTab('workouts')}>Activities</button>
  </div>
</header>

<!-- ── Panels ──────────────────────────────────────────────── -->
<main class="panels">

  <!-- TODAY -->
  <div class="panel" class:active={$activeTab === 'today'} id="panel-today">
    <Today />
  </div>

  <!-- NUTRITION -->
  <div class="panel" class:active={$activeTab === 'nutrition'} id="panel-nutrition">
    <Nutrition />
  </div>

  <!-- WORKOUTS -->
  <div class="panel" class:active={$activeTab === 'workouts'} id="panel-workouts">
    <Workouts />
  </div>

</main>

<!-- ── Chat panel ──────────────────────────────────────────── -->
<div id="chat-panel" class="collapsed">
  <div class="chat-panel-handle-row" id="chat-panel-handle">
    <div class="chat-panel-handle"></div>
  </div>
  <div id="chat-peek-body">
    <div class="chat-peek-label">Claude</div>
    <div class="chat-peek-text" id="chat-peek-text"></div>
  </div>
  <div id="chat-panel-body">
    <div class="chat-header">
      <div class="sheet-title" style="margin:0">Claude</div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
  </div>
</div>

<!-- ── Input bar ───────────────────────────────────────────── -->
<input type="file" id="image-file-input" accept="image/*" multiple style="display:none" />
<div class="input-bar">
  <button class="mic-btn" id="mic-btn" aria-label="Voice input">
    <span class="material-symbols-outlined" style="font-size:18px">mic</span>
  </button>
  <button class="attach-btn" id="attach-btn" aria-label="Attach image">
    <span class="material-symbols-outlined" style="font-size:18px">photo_camera</span>
    <span class="attach-badge" id="attach-badge" style="display:none"></span>
  </button>
  <textarea class="input-field" id="main-input" rows="1"
    placeholder="Type something…" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
  <button class="send-btn" id="send-btn" aria-label="Send">
    <span class="material-symbols-outlined" style="font-size:18px;color:white">send</span>
  </button>
</div>

<!-- ── Sign-in overlay (reactive) ─────────────────────────── -->
{#if authReady && !$currentUser}
<div id="signin-overlay" class="signin-overlay">
  <div class="signin-card">
    <div class="signin-title">MyTracker</div>
    <div class="signin-sub">Sign in to view your data</div>
    <button class="github-signin-btn" data-action="signin">
      <span class="material-symbols-outlined" style="font-size:20px;vertical-align:-4px">login</span>
      Sign in with GitHub
    </button>
    <button class="github-signin-btn" data-action="signin-google" style="background: #4285F4; color: #fff;">
      <span class="material-symbols-outlined" style="font-size:20px;vertical-align:-4px">login</span>
      Sign in with Google
    </button>
    <button class="github-signin-btn" data-action="demo-mode" style="background: var(--warn); color: #fff;">
      <span class="material-symbols-outlined" style="font-size:20px;vertical-align:-4px">play_circle</span>
      Enter Demo Mode
    </button>
    <div style="margin-top:16px;font-size:12px;color:#888;text-align:center">
      <a href="privacy.html" style="color:#888">Privacy Policy</a> · <a href="terms.html" style="color:#888">Terms of Service</a>
    </div>
  </div>
</div>
{/if}

<!-- ── Backdrop ────────────────────────────────────────────── -->
<Backdrop />

<!-- ── Sheet components ────────────────────────────────────── -->
<WorkoutSheet />
<FoodSheet />
<WeightSheet />
<MealPresetSheet />
<WorkoutPresetSheet />
<ApiKeySheet />
<SettingsSheet />

<!-- ── Toast ──────────────────────────────────────────────── -->
<Toast />

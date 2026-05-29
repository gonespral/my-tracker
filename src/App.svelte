<script>
  import { onMount } from 'svelte'
  import { currentUser, openSheetId, activeTab } from './stores.js'
  import { initAuth, switchTab } from './lib/app-logic.js'
  import Toast from './components/layout/Toast.svelte'
  import Backdrop from './components/layout/Backdrop.svelte'
  import Today from './components/tabs/Today.svelte'
  import Nutrition from './components/tabs/Nutrition.svelte'
  import Workouts from './components/tabs/Workouts.svelte'

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

<!-- ── Activity sheet ──────────────────────────────────────── -->
<div class="sheet sheet-form" class:open={$openSheetId === 'intensity-sheet'} id="intensity-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="workout-sheet-title">Log Activity</div>
  <div id="workout-draft-banner" class="preset-match-banner" style="display:none"></div>
  <div class="form-field autocomplete-wrap">
    <label class="form-label" for="w-desc">Activity</label>
    <input class="form-input" id="w-desc" type="text" placeholder="e.g. Morning run" autocomplete="off" />
    <div class="autocomplete-list" id="w-desc-ac"></div>
  </div>
  <div style="display:flex;gap:8px">
    <div class="form-field" style="flex:1">
      <label class="form-label" for="w-date">Date</label>
      <input class="form-input" id="w-date" type="date" />
    </div>
    <div class="form-field" style="flex:1">
      <label class="form-label" for="w-time">Time</label>
      <input class="form-input" id="w-time" type="time" />
    </div>
  </div>
  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Intensity</label>
    <div class="intensity-btns" id="intensity-btns-main">
      <button class="intensity-btn" data-intensity="low" type="button">
        <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">signal_cellular_alt_1_bar</span>Low
      </button>
      <button class="intensity-btn active" data-intensity="medium" type="button">
        <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">signal_cellular_alt</span>Medium
      </button>
      <button class="intensity-btn" data-intensity="high" type="button">
        <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">trending_up</span>High
      </button>
    </div>
  </div>
  <div class="form-field">
    <label class="form-label" for="w-activity-type">Activity type <span style="font-size:11px;color:var(--tx3);font-weight:400">(auto-detected if blank)</span></label>
    <select class="form-input" id="w-activity-type">
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
    <label class="form-label" for="w-calories-burned">Calories burned (optional)</label>
    <input id="w-calories-burned" type="number" class="form-input" inputmode="numeric" placeholder="e.g. 350" min="0" />
  </div>
  <div class="form-row-2">
    <div class="form-field">
      <label class="form-label" for="w-duration-min">Duration (min)</label>
      <input id="w-duration-min" type="number" class="form-input" inputmode="numeric" placeholder="e.g. 45" min="0" />
    </div>
    <div class="form-field">
      <label class="form-label" for="w-distance-km">Distance (km)</label>
      <input id="w-distance-km" type="number" class="form-input" inputmode="decimal" placeholder="e.g. 5.2" min="0" step="0.1" />
    </div>
  </div>
  <div class="form-field">
    <label class="form-label" for="w-heart-rate">Avg heart rate (bpm)</label>
    <input id="w-heart-rate" type="number" class="form-input" inputmode="numeric" placeholder="e.g. 145" min="0" />
  </div>
  <button class="btn-primary" id="save-workout-btn">Log Activity</button>
</div>

<!-- ── Food sheet ─────────────────────────────────────────── -->
<div class="sheet sheet-form" class:open={$openSheetId === 'food-sheet'} id="food-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="food-sheet-title">Log Food</div>
  <div id="preset-match-banner" class="preset-match-banner" style="display:none"></div>
  <div class="form-field">
    <label class="form-label" for="f-date">Date</label>
    <input class="form-input" id="f-date" type="date" />
  </div>
  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Meal</label>
    <div class="meal-btns">
      <button class="meal-btn active" data-meal="breakfast" type="button">Breakfast</button>
      <button class="meal-btn" data-meal="lunch" type="button">Lunch</button>
      <button class="meal-btn" data-meal="snack" type="button">Snack</button>
      <button class="meal-btn" data-meal="dinner" type="button">Dinner</button>
    </div>
  </div>
  <div class="form-field autocomplete-wrap">
    <label class="form-label" for="f-desc">Description</label>
    <input class="form-input" id="f-desc" type="text" placeholder="e.g. Pasta pesto + 2 eggs" autocomplete="off" />
    <div class="autocomplete-list" id="f-desc-ac"></div>
  </div>
  <div class="form-field">
    <label class="form-label" for="f-cal">Calories (kcal)</label>
    <input class="form-input" id="f-cal" type="number" inputmode="numeric" placeholder="0" min="0" />
  </div>
  <div class="form-macros">
    <div class="form-field">
      <label class="form-label" for="f-pro">Protein (g)</label>
      <input class="form-input" id="f-pro" type="number" inputmode="numeric" placeholder="0" min="0" />
    </div>
    <div class="form-field">
      <label class="form-label" for="f-car">Carbs (g)</label>
      <input class="form-input" id="f-car" type="number" inputmode="numeric" placeholder="0" min="0" />
    </div>
    <div class="form-field">
      <label class="form-label" for="f-fat">Fat (g)</label>
      <input class="form-input" id="f-fat" type="number" inputmode="numeric" placeholder="0" min="0" />
    </div>
  </div>
  <button class="btn-primary" id="log-food-btn">Log Food</button>
</div>

<!-- ── Weight sheet ───────────────────────────────────────── -->
<div class="sheet" class:open={$openSheetId === 'weight-edit-sheet'} id="weight-edit-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="weight-sheet-title">Log weight</div>
  <div class="form-field">
    <label class="form-label" for="w-edit-kg">Weight (kg)</label>
    <input id="w-edit-kg" type="number" class="form-input" inputmode="decimal" step="0.1" placeholder="e.g. 73.5" />
  </div>
  <button class="btn-primary" id="save-weight-btn">Save</button>
</div>

<!-- ── Meal preset sheet ──────────────────────────────────── -->
<div class="sheet" class:open={$openSheetId === 'meal-preset-sheet'} id="meal-preset-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="meal-preset-title">New Meal</div>
  <div class="form-field">
    <label class="form-label" for="mp-name">Name</label>
    <input class="form-input" id="mp-name" type="text" placeholder="e.g. Oats with protein" />
  </div>
  <div class="form-field">
    <label class="form-label" for="mp-cal">Calories (kcal)</label>
    <input class="form-input" id="mp-cal" type="number" inputmode="numeric" placeholder="0" min="0" />
  </div>
  <div class="form-macros">
    <div class="form-field">
      <label class="form-label" for="mp-pro">Protein (g)</label>
      <input class="form-input" id="mp-pro" type="number" inputmode="numeric" placeholder="0" min="0" />
    </div>
    <div class="form-field">
      <label class="form-label" for="mp-car">Carbs (g)</label>
      <input class="form-input" id="mp-car" type="number" inputmode="numeric" placeholder="0" min="0" />
    </div>
    <div class="form-field">
      <label class="form-label" for="mp-fat">Fat (g)</label>
      <input class="form-input" id="mp-fat" type="number" inputmode="numeric" placeholder="0" min="0" />
    </div>
  </div>
  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Default meal</label>
    <div class="meal-btns" id="mp-meal-btns">
      <button class="meal-btn" data-meal="breakfast" type="button">Breakfast</button>
      <button class="meal-btn" data-meal="lunch" type="button">Lunch</button>
      <button class="meal-btn active" data-meal="snack" type="button">Snack</button>
      <button class="meal-btn" data-meal="dinner" type="button">Dinner</button>
    </div>
  </div>
  <button class="btn-primary" id="save-preset-btn">Save Meal</button>
</div>

<!-- ── Workout preset sheet ───────────────────────────────── -->
<div class="sheet" class:open={$openSheetId === 'workout-preset-sheet'} id="workout-preset-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="wps-title">New Workout</div>
  <div class="form-field">
    <label class="form-label" for="wps-name">Name</label>
    <input class="form-input" id="wps-name" type="text" placeholder="e.g. Morning swim" />
  </div>
  <div class="form-field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="form-label">Intensity</label>
    <div class="intensity-btns" id="wps-intensity-btns">
      <button class="intensity-btn" data-intensity="low" type="button">
        <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">signal_cellular_alt_1_bar</span>Low
      </button>
      <button class="intensity-btn active" data-intensity="medium" type="button">
        <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">signal_cellular_alt</span>Medium
      </button>
      <button class="intensity-btn" data-intensity="high" type="button">
        <span class="material-symbols-outlined" style="font-size:13px;margin-right:4px">trending_up</span>High
      </button>
    </div>
  </div>
  <div class="form-field">
    <label class="form-label" for="wps-calories-burned">Calories burned (optional)</label>
    <input class="form-input" id="wps-calories-burned" type="number" inputmode="numeric" placeholder="e.g. 350" min="0" />
  </div>
  <button class="btn-primary" id="save-wps-btn">Save Workout</button>
</div>

<!-- ── API key sheet ─────────────────────────────────────── -->
<div class="sheet" class:open={$openSheetId === 'apikey-sheet'} id="apikey-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Set up Claude AI</div>
  <p class="setup-note">
    Paste your <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic API key</a>.
    Stored locally — never sent anywhere except Anthropic's API.
  </p>
  <div class="form-field">
    <label class="form-label" for="apikey-input">API key</label>
    <input class="form-input" id="apikey-input" type="password" placeholder="sk-ant-..." autocomplete="off" />
  </div>
  <button class="btn-primary" id="save-apikey-btn">Save</button>
</div>

<!-- ── Settings sheet ────────────────────────────────────── -->
<div class="sheet sheet-tall" class:open={$openSheetId === 'settings-sheet'} id="settings-sheet" style="padding-bottom:0">
  <div class="sheet-handle"></div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div class="sheet-title" style="margin:0;display:flex;align-items:baseline;gap:8px">
      <span>Settings</span>
      <span id="settings-version" class="settings-version" aria-label="App version"></span>
    </div>
    <button id="settings-close-btn" class="chat-close-btn" style="font-size:18px">
      <span class="material-symbols-outlined" style="font-size:18px">close</span>
    </button>
  </div>
  <div id="settings-content" style="flex:1;overflow-y:auto;min-height:0;margin:0 -20px;padding:0 20px calc(20px + var(--safe-bot))"></div>
</div>

<!-- ── Toast ──────────────────────────────────────────────── -->
<Toast />

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev server

```bash
npm run dev      # Vite dev server (hot reload)
npm run build    # production build → dist/
npm run preview  # preview the dist/ build locally
```

Deployment is to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`. The workflow runs `npm ci && npm run build` and uploads `dist/`.

## Architecture

**Svelte 4 + Vite SPA.** `src/` contains all source; `dist/` is the build output (gitignored). The `js/` directory still exists but is the legacy source — **do not edit it**; all active code is in `src/`.

### Source layout

```
src/
  main.js              ← Vite entry: mounts App.svelte into #app
  app.css              ← imports css/style.css (global styles)
  App.svelte           ← root component: HTML shell, all sheets, tab routing, onMount → initAuth()
  stores.js            ← Svelte writable stores (replaces state.js singleton)
  lib/
    app-logic.js       ← all imperative app logic (event delegation, initApp, renderActive)
    state.js           ← proxy shim: state.xyz reads/writes map to Svelte stores
    db.js              ← Supabase client + all DB operations
    config.js          ← TARGETS, MEAL_ORDER, ACTIVITY_TYPE, calorie helpers
    ui.js              ← openSheet / closeSheets (update openSheetId store), toast, bindSnapDrag
    utils.js           ← pure helpers: dateStr, sumFood, fmt, fmtDate, etc.
    charts.js          ← SVG chart generators (ring, bar, sparkline, heatmap, streak)
    renderers.js       ← HTML template functions for log-item cards
    speech.js          ← Web Speech API integration
    ai.js              ← Claude API chat, daily wisdom, tool calls
    strava.js          ← Strava OAuth + sync
    google-health.js   ← Google Fit OAuth + sync
    sync-status.js     ← store-based sync indicator (consumed by top-bar)
    push-tracker.js    ← localStorage tracking of pushed activities
    animate.js         ← stagger / renderPanel animation helpers
    tutorial.js        ← first-run tutorial
    version.js         ← APP_VERSION (injected by CI)
    env.js             ← Vite env var re-exports (VITE_SUPABASE_URL, etc.)
    tabs/
      today.js         ← renderToday(), openFoodSheet(), editFood(), etc.
      nutrition.js     ← renderNutrition()
      workouts.js      ← renderWorkouts()
      settings.js      ← renderSettings(), openPresetSheet(), etc.
  components/
    layout/
      Toast.svelte     ← reactive toast driven by toastMsg store
      Backdrop.svelte  ← reactive overlay driven by openSheetId store
    sheets/
      Sheet.svelte     ← reusable base component for bottom drawers
```

### Key architectural patterns

**State management:** `src/stores.js` exports Svelte writable stores. `src/lib/state.js` is a Proxy that maps `state.xyz` reads/writes to those stores — this lets all lib files keep `import { state } from './state.js'` unchanged.

**Sheet open/close:** `openSheet(id)` and `closeSheets()` in `ui.js` set the `openSheetId` store. `App.svelte` applies `class:open={$openSheetId === 'sheet-id'}` to each inline sheet div. `Sheet.svelte` does the same for composed sheet components.

**Tab routing:** `activeTab` store drives `class:active` on both tab buttons and panel divs in `App.svelte`. `switchTab(tab)` in `app-logic.js` updates the store and calls `renderActive()`.

**Rendering:** Tab content is still rendered imperatively via `innerHTML` by today.js / nutrition.js / workouts.js into fixed DOM containers (`#panel-today`, `#panel-nutrition`, `#panel-workouts`). `renderActive()` in `app-logic.js` dispatches to the correct tab renderer.

**Event handling:** All click events on dynamically-rendered content are delegated from a top-level `document.addEventListener('click', ...)` in `app-logic.js` using `data-action` attributes.

**Auth:** `initAuth()` (exported from `app-logic.js`, called in `App.svelte`'s `onMount`) fetches the Supabase session, initialises the app, and subscribes to auth state changes. Sign-in overlay shown reactively via `{#if authReady && !$currentUser}`.

**Backend:** Supabase (URL + anon key from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars, exposed via `src/lib/env.js`). Auth is GitHub or Google OAuth. Tables: `food_entries`, `workout_entries`, `weight_entries`, `meal_presets`, `workout_presets`, `user_settings`.

**AI chat:** Claude API called directly from the browser; Anthropic key stored in `localStorage` and entered via the settings sheet.

**Third-party integrations:** Strava and Google Health use OAuth PKCE flows; tokens and credentials stored in `localStorage`.

**Theme:** Light/dark via `data-theme` on `<html>`, persisted to `localStorage`. Applied before first paint by an inline script in `index.html`'s `<head>`.

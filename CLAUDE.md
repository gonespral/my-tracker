# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev server

```bash
npm run dev   # serves on http://localhost:3000 via npx serve
```

No build step — the app is plain ES modules served as static files. Deployment is to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.

## Architecture

Vanilla JS single-page app. No framework, no bundler. The HTML shell (`index.html`) is static; all panels are rendered dynamically by JS modules using `innerHTML`.

**Module dependency flow:**

```
index.html
  └── js/app.js          ← entry point: bootstraps auth, tabs, event delegation
        ├── js/state.js  ← singleton mutable state object shared across all modules
        ├── js/db.js     ← Supabase client + all DB operations (with cache busting)
        ├── js/config.js ← constants: TARGETS, MEAL_ORDER, ACTIVITY_TYPE, detectActivityType()
        ├── js/ui.js     ← sheet open/close, toast, menu toggle helpers
        ├── js/utils.js  ← pure helpers: dateStr, sumFood, fmt, fmtDate, etc.
        ├── js/charts.js ← SVG chart generators (ring, bar, sparkline, heatmap, streak)
        ├── js/renderers.js ← HTML template functions for log-item cards
        ├── js/speech.js ← Web Speech API integration
        ├── js/strava.js ← Strava OAuth + sync
        ├── js/google-health.js ← Google Fit OAuth + sync
        ├── js/food-db.js ← USDA FoodData Central + Open Food Facts lookups for the AI chat, with caching/throttling
        └── js/tabs/
              ├── today.js     ← renders #panel-today
              ├── nutrition.js ← renders #panel-nutrition
              └── workouts.js  ← renders #panel-workouts
```

**Backend:** Supabase (URL + anon key in `js/config.js`). Auth is GitHub OAuth via Supabase. Row-level security enforced server-side — all queries are user-scoped automatically. Tables: `food_entries`, `workout_entries`, `weight_entries`, `meal_presets`, `workout_presets`, `user_settings`.

**State management:** `state.js` exports a single mutable object imported by all modules. DB results are cached in `state.dbCache`; call `db.bust()` after any write to invalidate.

**Event handling:** All click events are delegated from a top-level listener in `app.js` using `data-action` attributes on elements. Sheets (bottom drawers) are opened via `openSheet(id)` from `ui.js`.

**AI chat:** Claude API is called directly from the browser using an Anthropic API key stored in `localStorage`. The key is entered by the user via the settings sheet. Before logging food, Claude calls a `lookup_food` tool (`js/food-db.js`) to check real nutrition data (USDA, then Open Food Facts as a fallback) and a `calculate` tool to scale it to the portion eaten, rather than estimating from memory. Tool activity is logged to the console and shown as a small log line in the chat UI.

**Third-party integrations:** Strava and Google Health both use OAuth PKCE flows storing tokens in `localStorage`. Credentials (client ID/secret) are also stored in `localStorage` — entered by the user in Settings.

**Calorie targets:** Dynamically switch between `TARGETS.calories.rest` and `TARGETS.calories.training` based on whether any workout is logged for that day. Targets can be overridden per-user via `user_settings` in Supabase.

**Theme:** Light/dark toggled by `data-theme` attribute on `<html>`, persisted to `localStorage` under key `tracker-theme`. Applied before first paint via an inline script in `<head>`.

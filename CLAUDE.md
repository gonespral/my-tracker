# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server on http://localhost:3000
npm run build    # tsc -b && vite build -> dist/
npm run preview  # serve the production build locally
```

Env vars go in `.env.local` (gitignored, `VITE_`-prefixed — see `.env.example`). Deployment is to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`; it writes a `.env.production` from repository secrets before building. Demo mode: append `?demo=1` (seeds an in-memory mock DB, no backend needed).

## Architecture

React 19 + TypeScript + Vite single-page app with a single Zustand store. Entry: `index.html` → `src/main.tsx` → `src/App.tsx` (auth session, background integration sync, always-mounted sheets/chat/tutorial, tab switching).

```
src/
  store.ts            ← single Zustand store (state shape + SheetId type)
  App.tsx             ← bootstraps auth, sync, mounts tabs + all sheets
  tabs/               ← Today.tsx, Activities.tsx, Nutrition.tsx
  components/
    charts/           ← real JSX/SVG chart components (CalRing, WeekChart, MonthHeatmap, …)
    sheets/           ← bottom-drawer forms (Food, Activity, Weight, Settings, presets, …)
    Sheet.tsx         ← generic always-mounted drawer w/ drag-to-dismiss
    EntryMenu.tsx     ← shared three-dot menu (one open at a time, raises host z-index)
    Tutorial.tsx      ← first-run slideshow overlay
  lib/
    db.ts             ← Supabase client + all DB ops (cache busting, conflict resolution, demo mock)
    config.ts         ← TARGETS, MEAL_ORDER, ACTIVITY_TYPE, detectActivityType()
    sheets.ts         ← openXSheet()/closeSheet() helpers (preset sheets return to Settings)
    utils.ts          ← pure helpers + shared types (FoodEntry, WorkoutEntry, presets)
    ai.ts             ← Claude chat: system prompt, tool loop, persistence
    food-db.ts        ← USDA FoodData Central + Open Food Facts lookups
    strava.ts / google-health.ts / push-tracker.ts ← OAuth, sync, push, dedup
    sync-status.ts    ← syncCounts/syncFailed store updates (TopBar renders them)
    speech.ts         ← useSpeechInput() hook (Web Speech API)
```

**Backend:** Supabase (URL + anon key from env). Auth is GitHub/Google OAuth via Supabase. Row-level security enforced server-side — all queries are user-scoped automatically. Tables: `food_entries`, `workout_entries`, `weight_entries`, `meal_presets`, `workout_presets`, `user_settings`, `user_integrations`. Strava/Google Health token exchange goes through Supabase Edge Functions (`supabase/functions/`).

**State:** read with the hook (`useAppStore((s) => s.foo)`) inside components; via `useAppStore.getState()/.setState()` from non-component code. DB results are cached in `state.dbCache`; every write calls `db.bust()`, which increments `dataGen` — tabs subscribe to `dataGen` and refetch. `mealsCache`/`workoutPresetsCache` are set to `null` to invalidate; readers lazily reload.

**Naming:** the data layer says "workout" (`WorkoutEntry`, `db.addWorkout`, table `workout_entries` — matches the DB schema, don't rename); the UI layer says "Activity"/"Activities" (components, tab label, store keys). Keep this split.

**Charts** are real JSX/SVG components — never build SVG as HTML strings / `dangerouslySetInnerHTML`. Icons render via `<Icon name="..."/>` (Material Symbols font); icon maps in `config.ts`/`icons.ts` store plain name strings, never HTML.

**Sheets** (bottom drawers) are all mounted once in `App.tsx`; visibility is the `.open` class driven by `store.openSheetId` so close transitions play. Open/close only through the helpers in `lib/sheets.ts`.

**Stats sections** (`.stats-section` in each tab) must stay mounted and be hidden with inline `display` — desktop CSS force-shows them and hides the `.stats-toggle` button, so conditional rendering breaks desktop.

**AI chat:** Claude API called directly from the browser; the Anthropic API key lives in `localStorage` (entered via Settings). Before logging food, Claude calls a `lookup_food` tool (`lib/food-db.ts` — USDA, then Open Food Facts as a fallback) and a `calculate` tool to scale to the portion eaten, rather than estimating from memory. Tool activity shows as a small log line in the chat UI.

**Third-party integrations:** Strava and Google Health OAuth store tokens in `localStorage`; token exchange/refresh goes through Supabase Edge Functions by default, or fully client-side with user-supplied custom credentials.

**Calorie targets:** dynamically switch between `TARGETS.calories.rest` and `.training` based on whether a workout is logged that day; per-user overrides live in `user_settings`. `TARGETS` is a mutable object read directly by components — after changing it, call `db.bust()` so mounted tabs re-render.

**Theme:** light/dark via `data-theme` attribute on `<html>`, persisted to `localStorage` under key `tracker-theme`, applied before first paint by an inline script in `index.html`.

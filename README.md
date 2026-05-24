# <picture><source media="(prefers-color-scheme: dark)" srcset="brand/svg/logo-mono-light.svg"><source media="(prefers-color-scheme: light)" srcset="brand/svg/logo-mono-dark.svg"><img alt="MyTracker" src="brand/svg/logo-mono-dark.svg" width="36" align="top"></picture> MyTracker

> [!WARNING]
> This project is heavily vibecoded. It exists because every fitness tracker I tried either lacked the one feature I actually needed, buried useful functionality behind a subscription, or couldn't integrate properly with services like Strava and Google Fit without some janky middleware. So I built my own, host it myself, and only add features I personally want. Expect rough edges, unconventional patterns, and code that works because it works.

---

MyTracker is a self-hosted health and fitness tracking dashboard built with vanilla HTML, CSS, and JavaScript. It uses Supabase as its backend and integrates a client-side Claude assistant for natural-language food, workout, and weight logging. No frameworks, no build step, no subscriptions, no server-side middleware.

## Architecture

Vanilla JS single-page application. The HTML shell (`index.html`) is static. All panels are rendered dynamically by JS modules using `innerHTML`. Events are delegated from a single top-level listener in `app.js` using `data-action` attributes.

**State management:** `state.js` exports a single mutable object imported by all modules. DB results are cached in `state.dbCache`; call `db.bust()` after any write to invalidate.

**Authentication:** GitHub OAuth via Supabase. Sign-in overlay is shown when no session exists.

**AI chat:** Claude API is called directly from the browser using an Anthropic API key stored in `localStorage`. The key is entered by the user in the settings sheet and never leaves the browser except in direct requests to Anthropic.

## Database

All SQL lives in `supabase/migrations/` and is meant to be run in order against a fresh Supabase project. The initial migration (`00001_initial_schema.sql`) creates every table, enables Row-Level Security with per-user policies on all tables, and adds performance indexes.

| Migration | What it does |
|:---|:---|
| `00001_initial_schema.sql` | Tables (`food_entries`, `workout_entries`, `weight_entries`, `meal_presets`, `workout_presets`, `user_settings`), RLS policies, indexes |

---

## Setup

### Prerequisites

Node.js (for the dev server convenience script) or any static HTTP server.

### Local Development

```bash
git clone https://github.com/your-username/health-tracker.git
cd health-tracker
npm run dev
```

The app serves at `http://localhost:3000`. There is no build step — all files are plain ES modules served as static assets.

### Supabase Configuration

1. Create a new Supabase project.
2. Open the SQL Editor in the Supabase dashboard and run each file in `supabase/migrations/` in order (starting with `00001_initial_schema.sql`). This creates all tables, RLS policies, and indexes.
3. Copy `js/env.example.js` to `js/env.js` and fill in your Supabase details (and any OAuth Client IDs you wish to provide by default). `js/env.js` is git-ignored to keep your keys safe.
4. Enable **GitHub** as an authentication provider under Authentication > Providers in the Supabase dashboard.
5. Add your local and production URLs as redirect URIs.

### Claude AI

1. Get an API key from the [Anthropic Console](https://console.anthropic.com/).
2. Open the app, click the settings icon, and paste your key.

The key is stored in `localStorage` and only sent to Anthropic's API endpoint.

### Strava and Google Fit

Enter client credentials in the settings sheet within the app.

- **Strava:** Register an app at [strava.com/settings/api](https://www.strava.com/settings/api).
- **Google Fit:** Create a web client ID in the [Google API Console](https://console.developers.google.com/) and enable the Fitness API.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the static files to GitHub Pages.

**Important for deployment:** Because this is a static site without a build step, the deployment workflow expects your environment variables to be set as **GitHub Actions Secrets**. 

Go to your repository settings > **Secrets and variables** > **Actions** and add the following repository secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `STRAVA_CLIENT_ID`
- `GOOGLE_HEALTH_CLIENT_ID`

The deployment action will automatically inject these into a generated `js/env.js` file before publishing to GitHub Pages, keeping your codebase completely free of hardcoded keys!

## License

[MIT](LICENSE)
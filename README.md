# <picture><source media="(prefers-color-scheme: dark)" srcset="brand/svg/logo-mono-light.svg"><source media="(prefers-color-scheme: light)" srcset="brand/svg/logo-mono-dark.svg"><img alt="MyTracker" src="brand/svg/logo-mono-dark.svg" width="36" align="top"></picture> MyTracker

<p align="center">
	<img src="brand/shots/510_1x_shots_so.png" alt="MyTracker Screenshot 1" width="48%">
	<img src="brand/shots/866_1x_shots_so.png" alt="MyTracker Screenshot 2" width="48%">
</p>

Self-hosted health and fitness tracker. Svelte 4 + Vite frontend, Supabase backend, Claude AI assistant for natural-language logging. No subscriptions.

Try the demo at [gonespral.github.io/my-tracker](https://gonespral.github.io/my-tracker/?demo=1).

> [!note]
> This project is heavily vibecoded. It exists because every fitness tracker I tried either lacked the one feature I actually needed, buried it behind a subscription, or couldn't integrate with Strava and Google Fit without janky middleware. So I built my own. Expect rough edges and code that works because it works.

## Features

- **AI Logging:** Chat with Claude to log food, workouts, and weight in plain English. Attach photos and Claude uses vision to identify meals. Frequently logged items are suggested as presets automatically.
- **Nutrition:** Daily food tracking with calorie and macro targets (rest vs. training day). Meal presets for quick re-logging.
- **Workouts:** Manual logging with intensity, duration, distance, and heart rate. Activity presets.
- **Voice input:** Dictate food or workout entries via the Web Speech API.
- **PWA:** Installable, mobile-first, dark mode, smooth animations.
- **Privacy-first:** Your Supabase instance, your data. Row-Level Security on all tables. API keys live only in `localStorage`.

### Strava integration

- **Auto-sync:** Pulls the last 90 days of activities from Strava on load. Deleted Strava activities are removed locally on the next sync.
- **Push to Strava:** Manually logged workouts can be pushed to Strava directly from the Workouts tab.
- **Auto-push:** Optionally push every new locally logged activity to Strava automatically.
- **Cross-push:** Optionally push Google Health imports to Strava automatically.
- **Calorie spoofing:** Strava doesn't allow setting calories on manually created activities via the API. When enabled, the app derives a synthetic heart rate from your logged calories, duration, weight, age, and sex (Keytel et al. 2005), uploads the activity as a TCX file, and lets Strava compute the calories from heart rate data. Requires weight, age, and sex set in Settings → Profile.
- **Delete from Strava:** Delete synced activities from Strava directly within the app, with a confirmation prompt.
- **Sync controls:** Pause/resume Strava sync without disconnecting.
- **Duplicate detection:** Activities already in your Supabase database are never re-imported.
- **Stacked duplicate cards:** When the same activity is detected from multiple sources (e.g. both Strava and Google Health), they are displayed as stacked cards with expand/collapse.
- **Custom credentials:** Use your own Strava API app instead of the shared one.

### Google Health integration

- **Auto-sync:** Pulls the last 90 days of activities from Google Health on load.
- **Push to Google Health:** Manually logged workouts can be pushed to Google Health directly from the Workouts tab.
- **Auto-push:** Optionally push every new locally logged activity to Google Health automatically.
- **Cross-push:** Optionally push Strava imports to Google Health automatically.
- **Delete from Google Health:** Delete synced activities from Google Health directly within the app, with a confirmation prompt.
- **Sync controls:** Pause/resume Google Health sync without disconnecting.
- **Duplicate detection:** Activities already in your Supabase database are never re-imported.
- **Custom credentials:** Use your own Google Cloud OAuth client instead of the shared one.
- **Bidirectional sync:** The same activity type mapping is used in both directions, so a run synced from Strava and pushed to Google Health keeps its type.

### Sync status indicator

A persistent indicator in the header shows which integrations are currently syncing and highlights any that have failed, with a spinner on the refresh button during active sync.

## Setup

See [SETUP.md](SETUP.md) for full step-by-step instructions.

## License

[MIT](LICENSE)

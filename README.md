# <picture><source media="(prefers-color-scheme: dark)" srcset="brand/svg/logo-mono-light.svg"><source media="(prefers-color-scheme: light)" srcset="brand/svg/logo-mono-dark.svg"><img alt="MyTracker" src="brand/svg/logo-mono-dark.svg" width="36" align="top"></picture> MyTracker

<p align="center">
	<img src="brand/shots/510_1x_shots_so.png" alt="MyTracker Screenshot 1" width="48%">
	<img src="brand/shots/866_1x_shots_so.png" alt="MyTracker Screenshot 2" width="48%">
</p>

Self-hosted health and fitness tracker. Vanilla HTML/CSS/JS, Supabase backend, Claude AI assistant for natural-language logging. No framework, no build step, no subscriptions.

Try the demo at [gonespral.github.io/my-tracker](https://gonespral.github.io/my-tracker/?demo=1).

> [!warning]
> This project is heavily vibecoded. It exists because every fitness tracker I tried either lacked the one feature I actually needed, buried it behind a subscription, or couldn't integrate with Strava and Google Fit. So I built my own. Expect rough edges and code that works because it works.

## Features

- **AI Logging:** Chat with Claude to log food, workouts, and weight in plain English. Attach photos and Claude uses vision to identify meals. Frequently logged items are suggested as presets automatically.
- **Nutrition:** Daily food tracking with calorie and macro targets (rest vs. training day). Protein target can be set as a fixed amount or as g/kg of body weight. Meal presets for quick re-logging.
- **Workouts:** Manual logging with intensity, duration, distance, and heart rate. Activity presets.
- **Voice input:** Dictate food or workout entries via the Web Speech API.
- **PWA:** Installable, mobile-first, dark mode, smooth animations.
- **Privacy-first:** Your Supabase instance, your data. Row-Level Security on all tables. API keys live only in `localStorage`.

### Strava & Google Health integration

- **Sync:** Auto-pulls the last 90 days on load; pause/resume without disconnecting. Deleted Strava activities are removed on the next sync.
- **Push:** Send manually logged or imported activities to either service. Cross-push between the two services is supported. Activity type mapping is bidirectional.
- **Fidelity:** Strava pushes use TCX uploads, so calories and heart rate are preserved.
- **Duplicates:** Already-imported activities are never re-imported. Cross-source duplicates show as stacked cards.
- **Custom credentials:** Use your own Strava API app or Google Cloud OAuth client.

## Setup

See [SETUP.md](SETUP.md) for full step-by-step instructions.

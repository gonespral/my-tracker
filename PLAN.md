# Push to Google Health Plan

## Context

The existing Google Health integration (`js/google-health.js`) is pull-only, using scope `googlehealth.activity_and_fitness.readonly`. The task is to add **push** capability so manually-logged workouts can be written back to Google Health (and by extension, Fitbit, since Fitbit is being migrated into Google Health — legacy Fitbit accounts are deprecated end of May 2026).

**Key finding from official Google Health API docs (updated 2026-04-07):**
The API now exposes a write endpoint:
```
PATCH https://health.googleapis.com/v4/users/me/dataTypes/{data-type}/dataPoints/{data-point-id}
```
This is described as "insert or update a user's Fitbit app data." No separate Fitbit API is needed — Google Health is the unified platform.

---

## What to Build

No new file needed. Extend the existing `js/google-health.js` with push capability.

### 1. OAuth scope update

Change the existing scope in `connectGoogleHealth()` (`google-health.js` line 348) from:
```
googlehealth.activity_and_fitness.readonly
```
to:
```
googlehealth.activity_and_fitness
```
Users who already connected will need to re-authorize to grant write access. Add a notice in the settings UI for already-connected users who don't have write scope yet (detect via a new localStorage flag `google-health-can-write`).

### 2. New function: `pushActivityToGoogleHealth(entry)` in `google-health.js`

**Endpoint:** `PATCH https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints/{data-point-id}`

Generate a stable data-point ID from the entry (e.g. based on `entry.id` or timestamp) so the same workout isn't pushed twice.

**Request body:**
```json
{
  "dataSource": {
    "recordingMethod": "MANUALLY_ENTERED"
  },
  "exercise": {
    "interval": {
      "civilStartTime": "2026-05-26T08:00:00",
      "civilEndTime": "2026-05-26T09:00:00"
    },
    "exerciseType": "RUNNING",
    "metricsSummary": {
      "caloriesKcal": 350,
      "distance": 5000
    }
  }
}
```

Use `parseWorkoutStart()` from `db.js` for time extraction (same pattern as Strava push).

Map `entry.activity_type` → Google Health exercise type string using a `ACTIVITY_TYPE_TO_GH` map (mirroring the existing `ACTIVITY_TYPE_TO_STRAVA` map in strava.js).

On 401: call `disconnectGoogleHealth(true)`.

### 3. Settings UI

In `js/tabs/settings.js`, add a "Push to Google Health" toggle in the connected-UI section (after the existing force-sync button, same style as the Strava auto-push toggle). Also add a note if the user is connected but with the old read-only scope, prompting re-authorization.

### 4. Renderers: "Push to Google Health" menu item

In `js/renderers.js` line 126, alongside "Push to Strava", add:
```js
if (!isImported && googleHealthIsConnected()) {
  menuItems.push(`<button data-action="push-to-google-health" data-id="${e.id}">Push to Google Health</button>`)
}
```

### 5. App.js: push action handler

Add `push-to-google-health` case in the click delegation switch, mirroring the `push-to-strava` case at line 102. Also import `pushActivityToGoogleHealth` from `google-health.js`.

---

## Unknown: Exercise data type write schema

The PDF shows the `patch` endpoint for `body-fat` — the exact JSON schema for `exercise` isn't in this doc. Need to check the full Google Health API reference for the exercise write schema before implementing. Options:
1. Check `https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/patch` for the exercise data type schema
2. Or try a test PATCH with the same structure as what the pull returns (GET response shape often matches PATCH body shape in Google APIs)

This is the one open question before coding can start.

---

## Files to Modify

| File | Change |
|------|--------|
| `js/google-health.js` | Update OAuth scope, add `pushActivityToGoogleHealth()`, export it |
| `js/tabs/settings.js` | Add push toggle + re-auth notice in Google Health section |
| `js/renderers.js` | Add "Push to Google Health" menu item |
| `js/app.js` | Import `pushActivityToGoogleHealth`, add `push-to-google-health` action handler |

No new files. No Fitbit API integration needed.

---

## Verification

1. Disconnect and reconnect Google Health → confirm new scope granted
2. Log a manual workout → three-dot menu → "Push to Google Health" → confirm it appears in the Google Health app / Fitbit app
3. Verify no duplicate is created if pushed twice (idempotent via stable data-point ID)
4. Confirm pull sync still works after scope change

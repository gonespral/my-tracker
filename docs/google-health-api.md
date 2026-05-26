# Google Health API Reference

> Source: official Google Health API docs, captured 2026-05-26.
> Last doc update: 2026-05-14 (data types), 2026-04-07 (endpoints).

---

## Status / Migration context

- **Legacy Fitbit accounts are deprecated end of May 2026.** The Google Health API is the official replacement for the Fitbit Web API.
- Until end of May 2026, breaking changes may still occur as Google responds to developer feedback.
- Fitbit devices still sync exclusively via the Fitbit mobile app → data flows to third parties through the Google Health API (not directly from device).
- Device syncs every ~15 min when Fitbit app is open and in Bluetooth range.

---

## Base URL

```
https://health.googleapis.com/v4/
```

---

## OAuth scopes

Full prefix: `https://www.googleapis.com/auth/`

| Scope suffix | Permission |
|---|---|
| `googlehealth.activity_and_fitness` | Read + **write** activity & fitness data to Fitbit app |
| `googlehealth.activity_and_fitness.readonly` | Read only — current scope used by this app |
| `googlehealth.health_metrics_and_measurements` | Read + write health metrics (weight, heart rate, etc.) |
| `googlehealth.health_metrics_and_measurements.readonly` | Read only |
| `googlehealth.nutrition` | Read + write nutrition/hydration data |
| `googlehealth.nutrition.readonly` | Read only |
| `googlehealth.sleep` | Read + write sleep data |
| `googlehealth.sleep.readonly` | Read only |
| `googlehealth.profile` | Read + write profile data |
| `googlehealth.profile.readonly` | Read only |
| `googlehealth.location.readonly` | GPS location from exercises (read only) |
| `googlehealth.settings` | Read + write Fitbit app settings |
| `googlehealth.settings.readonly` | Read only |

---

## Data type naming convention

- In **endpoint URLs**: kebab-case → `body-fat`, `active-zone-minutes`
- In **filter parameters**: snake_case → `body_fat`, `active_zone_minutes`

---

## Data types — full table

Record types: **Interval** (time-bounded activity), **Sample** (point-in-time measurement), **Session** (structured activity with start/end), **Daily** (one entry per day).

Write ops (`create`, `update`, `batchDelete`) = **app can push this data to Fitbit**.

| Data type | URL identifier | Record type | Available operations | Scope | Webhook |
|---|---|---|---|---|---|
| Active Minutes | `active-minutes` | Interval | reconcile, rollup, dailyRollup | activity_and_fitness | |
| Active Zone Minutes | `active-zone-minutes` | Interval | list, reconcile, rollup, dailyRollup | activity_and_fitness | ✓ |
| Activity Level | `activity-level` | Interval | list, reconcile | activity_and_fitness | |
| Altitude | `altitude` | Interval | list, reconcile, rollup, dailyRollup | activity_and_fitness | ✓ |
| Body Fat | `body-fat` | Sample | list, get, reconcile, rollup, dailyRollup, **create, update, batchDelete** | health_metrics_and_measurements | ✓ |
| Calories In HR Zone | `calories-in-heart-rate-zone` | Interval | rollup, dailyRollup | activity_and_fitness | ✓ |
| Daily Heart Rate Variability | `daily-heart-rate-variability` | Daily | list, reconcile | health_metrics_and_measurements | ✓ |
| Daily Heart Rate Zones | `daily-heart-rate-zones` | Daily | reconcile | health_metrics_and_measurements | ✓ |
| Daily Oxygen Saturation | `daily-oxygen-saturation` | Daily | list, reconcile | health_metrics_and_measurements | ✓ |
| Daily Respiratory Rate | `daily-respiratory-rate` | Daily | list, reconcile | health_metrics_and_measurements | |
| Daily Resting Heart Rate | `daily-resting-heart-rate` | Daily | list, reconcile | health_metrics_and_measurements | ✓ |
| Daily Sleep Temp Derivations | `daily-sleep-temperature-derivations` | Daily | list, reconcile | health_metrics_and_measurements | ✓ |
| Daily VO2 Max | `daily-vo2-max` | Daily | list, reconcile | activity_and_fitness | |
| Distance | `distance` | Interval | list, reconcile, rollup, dailyRollup | activity_and_fitness | ✓ |
| **Exercise** | `exercise` | **Session** | list, get, reconcile, **create, update, batchDelete** | **activity_and_fitness** | ✓ |
| Floors | `floors` | Interval | reconcile, rollup, dailyRollup | activity_and_fitness | ✓ |
| Heart Rate | `heart-rate` | Sample | list, reconcile, rollup, dailyRollup | health_metrics_and_measurements | ✓ |
| Heart Rate Variability | `heart-rate-variability` | Sample | list, reconcile | health_metrics_and_measurements | |
| Height | `height` | Sample | list, get, reconcile, **create, update, batchDelete** | health_metrics_and_measurements | |
| Hydration Log | `hydration-log` | Session | list, get, reconcile, rollup, dailyRollup, **create, update, batchDelete** | nutrition | |
| Oxygen Saturation | `oxygen-saturation` | Sample | list, reconcile | health_metrics_and_measurements | |
| Respiratory Rate Sleep Summary | `respiratory-rate-sleep-summary` | Sample | list, reconcile | health_metrics_and_measurements | |
| Run VO2 Max | `run-vo2-max` | Sample | list, reconcile, rollup, dailyRollup | activity_and_fitness | |
| Sedentary Period | `sedentary-period` | Interval | list, reconcile, rollup, dailyRollup | activity_and_fitness | |
| Sleep | `sleep` | Session | list, get, reconcile, **create, update, batchDelete** | sleep | ✓ |
| Steps | `steps` | Interval | list, reconcile, rollup, dailyRollup | activity_and_fitness | ✓ |
| Swim Lengths Data | `swim-lengths-data` | Interval | list, reconcile, rollup, dailyRollup | activity_and_fitness | |
| Time in Heart Rate Zone | `time-in-heart-rate-zone` | Interval | reconcile, rollup, dailyRollup | activity_and_fitness | |
| Total Calories | `total-calories` | Interval | rollup, dailyRollup | activity_and_fitness | ✓ |
| VO2 Max | `vo2-max` | Sample | list, reconcile | activity_and_fitness | |
| Weight | `weight` | Sample | list, get, reconcile, rollup, dailyRollup, **create, update, batchDelete** | health_metrics_and_measurements | ✓ |

---

## Standard methods (AIP-131–135)

| Operation | HTTP method | Notes |
|---|---|---|
| `list` / filter | `GET` | Query params for filter/pagination |
| `get` | `GET /{name}` | Single resource by name |
| `reconcile` | `GET :reconcile` | Deduped stream from a data source family |
| `rollUp` | `POST :rollUp` | Aggregate over time window (body = range + windowSize) |
| `dailyRollUp` | `POST :dailyRollUp` | Daily aggregate (body = civil time range) |
| `create` | `POST` | Insert new data point — body = JSON data |
| `update` | `PATCH /{name}` | Update existing data point |
| `batchDelete` | `POST :batchDelete` | Delete array of data points by name |

**Required headers** (both GET and POST):
```
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json   (for POST/PATCH)
```

---

## Exercise — pull (existing, `js/google-health.js`)

```
GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints
    ?filter=exercise.interval.civil_start_time >= "YYYY-MM-DDT00:00:00"
    &page_size=200
    &page_token=<token>   (for pagination)
```

Response field paths used by current code:
- `dp.exercise.interval.startTime` / `.endTime` — ISO-8601 timestamps
- `dp.exercise.exerciseType` — string enum (see mapping below)
- `dp.exercise.metricsSummary.caloriesKcal`
- `dp.exercise.metricsSummary.distanceKm` / `.distanceM` / `.distanceMi` (current fallback chain)
- `dp.name` — used as `external_id` (path like `users/{id}/dataTypes/exercise/dataPoints/{id}`)

---

## Exercise — push (to implement)

### Create new exercise
```
POST https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "exercise": {
    "interval": {
      "startTime": "2026-05-26T08:00:00Z",
      "endTime":   "2026-05-26T09:00:00Z"
    },
    "exerciseType": "RUNNING",
    "metricsSummary": {
      "caloriesKcal": 350,
      "distanceMillimeters": 5000000
    }
  }
}
```

> **Distance unit**: the API standard unit is **millimeters**.
> Convert: `km * 1_000_000` → mm. Current pull code handles `distanceKm`/`distanceM`/`distanceMi` as fallbacks from the old API; new pushes should send `distanceMillimeters`.

### Update existing exercise
```
PATCH https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints/{data-point-id}
```

### Delete exercise
```
POST https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints:batchDelete
{
  "names": ["users/{user-id}/dataTypes/exercise/dataPoints/{id}"]
}
```

---

## Exercise type enum → app activity_type mapping

Used in both pull (GOOGLE_SPORT_MAP) and push (reverse map needed):

| Google Health `exerciseType` | App `activity_type` |
|---|---|
| `RUNNING` | `run` |
| `JOGGING` | `run` |
| `WALKING` | `walk` |
| `HIKING` | `walk` |
| `BIKING` | `cycle` |
| `CYCLING` | `cycle` |
| `MOUNTAIN_BIKING` | `cycle` |
| `SWIMMING` | `swim` |
| `ROWING` | `row` |
| `YOGA` | `yoga` |
| `PILATES` | `yoga` |
| `WEIGHT_TRAINING` | `lift` |
| `CROSSFIT` | `hiit` |
| `ELLIPTICAL` | `lift` |
| `ROCK_CLIMBING` | `climb` |
| `CROSS_TRAINING` | `hiit` |

Reverse map for push (app → Google Health):
```js
const ACTIVITY_TYPE_TO_GH = {
  run:   'RUNNING',
  walk:  'WALKING',
  cycle: 'BIKING',
  swim:  'SWIMMING',
  row:   'ROWING',
  yoga:  'YOGA',
  lift:  'WEIGHT_TRAINING',
  hiit:  'CROSSFIT',
  climb: 'ROCK_CLIMBING',
  box:   'WEIGHT_TRAINING',  // no boxing type
  tennis: 'CROSS_TRAINING',  // no tennis type
  ball:  'CROSS_TRAINING',
}
```

---

## Identity endpoint

Returns both legacy Fitbit user ID and Google user ID — useful for forward/backward compat:
```
GET https://health.googleapis.com/v4/users/me/identity
```

---

## What needs to change in `js/google-health.js` for push

1. **Scope**: change `googlehealth.activity_and_fitness.readonly` → `googlehealth.activity_and_fitness`
2. **Add** `ACTIVITY_TYPE_TO_GH` reverse map
3. **Add** `pushActivityToGoogleHealth(entry)` function using `POST .../exercise/dataPoints`
4. **Update** pull's distance fallback chain to also handle `distanceMillimeters` (new standard unit)
5. **Export** `pushActivityToGoogleHealth` and `googleHealthIsConnected`

Users who connected with the old scope must re-authorize to get write access. Detect via a `google-health-can-write` localStorage flag set during the new OAuth callback.

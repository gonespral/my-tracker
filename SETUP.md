# Setup Guide

Step-by-step instructions for self-hosting MyTracker. You will need accounts on Supabase, GitHub (for auth), and optionally Google Cloud and Strava.

---

## 1. Clone and run locally

```bash
git clone https://github.com/gonespral/my-tracker.git
cd my-tracker
cp js/env.example.js js/env.js
npm run dev   # http://localhost:3000
```

`js/env.js` is gitignored. Fill it in as you complete the steps below.

---

## 2. Supabase

Supabase provides the database and authentication.

### 2.1 Create a project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** (Settings → API).

### 2.2 Run migrations

In the Supabase dashboard go to **SQL Editor** and run each file in `supabase/migrations/` in order:

- `00001_initial_schema.sql` — creates all tables and RLS policies

### 2.3 Enable authentication providers

Go to **Authentication → Providers** and enable:

**GitHub**
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App.
2. Homepage URL: `https://your-site.com` (or `http://localhost:3000` for local dev)
3. Authorization callback URL: copy the callback URL from Supabase (Authentication → Providers → GitHub)
4. Copy the **Client ID** and generate a **Client Secret** → paste into Supabase.

**Google** (optional, for sign-in with Google)
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create OAuth client ID → Web application.
3. Authorized redirect URI: copy the callback URL from Supabase (Authentication → Providers → Google).
4. Copy the **Client ID** and **Client Secret** → paste into Supabase.

### 2.4 Set redirect URLs

In Supabase go to **Authentication → URL Configuration**:

- Site URL: `https://your-site.com`
- Redirect URLs: add both `https://your-site.com/**` and `http://localhost:3000/**`

### 2.5 Deploy edge functions

The Strava and Google Health OAuth flows use Supabase Edge Functions as token brokers (they hold your client secrets server-side so they are never exposed in the browser). Deploy them once:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy strava-oauth
npx supabase functions deploy google-health-oauth
```

Set the required secrets (replace values with your own):

```bash
npx supabase secrets set STRAVA_CLIENT_ID=your_id
npx supabase secrets set STRAVA_CLIENT_SECRET=your_secret
npx supabase secrets set GOOGLE_HEALTH_CLIENT_ID=your_id
npx supabase secrets set GOOGLE_HEALTH_CLIENT_SECRET=your_secret
```

> **Note:** If you prefer not to use the shared edge function approach, you can skip deploying these functions and enter your own client credentials directly in the app's Settings sheet using the "Use custom credentials" option for each integration.

### 2.6 Update env.js

```js
export const SUPABASE_URL = "https://yourproject.supabase.co"
export const SUPABASE_ANON_KEY = "your-anon-key"
export const STRAVA_CLIENT_ID = "your-strava-client-id"          // default/shared (optional)
export const GOOGLE_HEALTH_CLIENT_ID = "your-google-client-id"  // default/shared (optional)
```

---

## 3. GitHub Pages deployment

The included workflow (`.github/workflows/deploy.yml`) builds and publishes to GitHub Pages on every push to `main`. It injects the secrets below into a generated `js/env.js` before publishing, so you never commit credentials.

### 3.1 Enable GitHub Pages

1. Push your fork to GitHub.
2. Go to your repository → **Settings → Pages**.
3. Under **Build and deployment**, set Source to **GitHub Actions**.

### 3.2 Set repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Where to find it |
|:---|:---|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `STRAVA_CLIENT_ID` | Strava API settings page |
| `GOOGLE_HEALTH_CLIENT_ID` | Google Cloud Console → Credentials |

Once saved, push any commit to `main` to trigger the first deploy. The published URL will be shown in Settings → Pages.

---

## 4. Strava integration

The Strava integration supports two-way sync: pull activities from Strava and push locally logged workouts to Strava. The following features are available once connected:

- **Auto-sync on load** — last 90 days of activities pulled on each app load; activities deleted from Strava are removed locally on the next sync.
- **Push to Strava** — push any locally logged workout to Strava from the Workouts tab.
- **Auto-push** — toggle in Settings to automatically push every new local activity to Strava.
- **Cross-push from Google Health** — toggle to automatically push Google Health imports to Strava.
- **Delete from Strava** — delete a synced activity from Strava directly in the app (with confirmation prompt).
- **Pause sync** — pause/resume Strava sync without disconnecting.
### 4.1 Create a Strava app

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api).
2. Fill in:
   - **Application Name**: MyTracker (or anything)
   - **Category**: Data Importer
   - **Website**: `https://your-site.com`
   - **Authorization Callback Domain**: `your-site.com` (no `https://`, no path)
3. Submit — note your **Client ID** and **Client Secret**.

### 4.2 Add credentials to the edge function

```bash
npx supabase secrets set STRAVA_CLIENT_ID=your_client_id
npx supabase secrets set STRAVA_CLIENT_SECRET=your_client_secret
```

### 4.3 Connect in the app

Open MyTracker → Settings → Strava → Connect. You can also enable "Use custom credentials" and paste your own Client ID and Secret to bypass the shared edge function entirely.

### 4.4 Calories and heart rate

Activities are pushed to Strava as TCX file uploads. The TCX file includes your logged calorie count and heart rate (if present), which Strava picks up directly from the file.

---

## 5. Google Health integration

Google Health supports bidirectional sync: pull activities from Google Health and push locally logged workouts back. The following features are available once connected:

- **Auto-sync on load** — last 90 days of activities pulled on each app load.
- **Push to Google Health** — push any locally logged workout to Google Health from the Workouts tab.
- **Auto-push** — toggle in Settings to automatically push every new local activity to Google Health.
- **Cross-push from Strava** — toggle to automatically push Strava imports to Google Health.
- **Delete from Google Health** — delete a synced activity from Google Health directly in the app (with confirmation prompt).
- **Pause sync** — pause/resume Google Health sync without disconnecting.

Google Health requires a Google Cloud project with the Health API enabled. For personal use you can stay in **testing mode** and skip the full verification process.

### 5.1 Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → New Project → name it "MyTracker".
2. Go to **APIs & Services → Library** → search "Health" → enable **Google Health API**.

### 5.2 Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen** (now labelled **Google Auth Platform**).
2. **Branding**: set app name, homepage URL (`https://your-site.com`), privacy policy URL (`https://your-site.com/privacy.html`).
3. **Audience**:
   - User type: **External**
   - Publishing status: click **"Back to testing"** — this lets you use restricted scopes without going through Google's verification process.
   - Add your own Google account as a **test user**.
4. **Data Access** → Add scopes:
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly` (read/sync)
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness` (push/write)

### 5.3 Create OAuth credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URIs — add all that apply:
   - `https://your-site.com/`
   - `http://localhost:3000/`
4. Copy the **Client ID** and **Client Secret**.

### 5.4 Add credentials to the edge function

```bash
npx supabase secrets set GOOGLE_HEALTH_CLIENT_ID=your_client_id
npx supabase secrets set GOOGLE_HEALTH_CLIENT_SECRET=your_client_secret
```

### 5.5 Connect in the app

Open MyTracker → Settings → Google Health → Connect. To use your own credentials instead of the shared ones, enable "Use custom credentials" and paste your Client ID and Client Secret before connecting.

> **Note on testing mode:** Apps in testing mode are limited to 100 users and tokens expire every 7 days (users will be asked to re-authorize weekly). This is fine for personal use. If you want to share the app publicly with Google Health sync, you would need to go through Google's verification process, which requires a custom domain you own.

---

## 6. Claude AI (optional)

Get an API key from the [Anthropic Console](https://console.anthropic.com/) and paste it in MyTracker → Settings → AI. The key is stored only in your browser's `localStorage` and is never sent to any server other than Anthropic's API directly.

---

## 7. Profile settings (optional)

Some features require profile data set in Settings → Profile:

| Field | Used by |
|:---|:---|
| Weight | Calorie target calculation |
| Calorie targets | Rest-day and training-day calorie targets (can override defaults) |

---

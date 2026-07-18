/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STRAVA_CLIENT_ID: string
  readonly VITE_GOOGLE_HEALTH_CLIENT_ID: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_COMMIT_TIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __BUILD_TIME__: string

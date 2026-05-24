-- MyTracker: user integrations
-- Stores OAuth tokens for third-party integrations (Strava, Google Health)

CREATE TABLE public.user_integrations (
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider       TEXT NOT NULL CHECK (provider IN ('strava', 'google-health')),
    access_token   TEXT NOT NULL,
    refresh_token  TEXT NOT NULL,
    expires_at     BIGINT,
    display_name   TEXT,
    last_sync      BIGINT,
    metadata       JSONB DEFAULT '{}',
    updated_at     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations"
    ON public.user_integrations FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

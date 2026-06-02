-- MyTracker: initial schema
-- Creates all tables, enables Row-Level Security, and adds performance indexes.

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE public.food_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date        DATE NOT NULL,
    description TEXT NOT NULL,
    calories    NUMERIC NOT NULL CHECK (calories >= 0),
    protein     NUMERIC DEFAULT 0 CHECK (protein >= 0),
    carbs       NUMERIC DEFAULT 0 CHECK (carbs >= 0),
    fat         NUMERIC DEFAULT 0 CHECK (fat >= 0),
    meal               TEXT CHECK (meal IN ('breakfast', 'lunch', 'snack', 'dinner', 'supplement')),
    supplement_dose_g  NUMERIC CHECK (supplement_dose_g >= 0),
    created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.workout_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date            DATE NOT NULL,
    description     TEXT NOT NULL,
    intensity       TEXT CHECK (intensity IN ('low', 'medium', 'high')),
    activity_type   TEXT,
    sport_type      TEXT,
    calories_burned NUMERIC CHECK (calories_burned >= 0),
    duration_min    NUMERIC CHECK (duration_min >= 0),
    distance_km     NUMERIC CHECK (distance_km >= 0),
    heart_rate_avg  NUMERIC CHECK (heart_rate_avg >= 0),
    time            TEXT,
    source          TEXT DEFAULT 'manual',
    external_id     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.weight_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date       DATE NOT NULL,
    kg         NUMERIC NOT NULL CHECK (kg > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT weight_entries_user_date_key UNIQUE (user_id, date)
);

CREATE TABLE public.meal_presets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name       TEXT NOT NULL,
    calories   NUMERIC NOT NULL CHECK (calories >= 0),
    protein    NUMERIC DEFAULT 0 CHECK (protein >= 0),
    carbs      NUMERIC DEFAULT 0 CHECK (carbs >= 0),
    fat        NUMERIC DEFAULT 0 CHECK (fat >= 0),
    meal       TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.workout_presets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    intensity       TEXT CHECK (intensity IN ('low', 'medium', 'high')),
    calories_burned NUMERIC CHECK (calories_burned >= 0),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_settings (
    user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    -- Calorie profile
    cal_rest            NUMERIC CHECK (cal_rest > 0),
    cal_training        NUMERIC CHECK (cal_training > 0),
    protein_g           NUMERIC CHECK (protein_g >= 0),
    protein_per_kg      NUMERIC CHECK (protein_per_kg > 0),
    carbs_g             NUMERIC CHECK (carbs_g >= 0),
    fat_g               NUMERIC CHECK (fat_g >= 0),
    age_years           INTEGER CHECK (age_years >= 0),
    sex                 TEXT CHECK (sex IN ('female', 'male', 'other')),
    height_cm           NUMERIC CHECK (height_cm > 0),
    weight_kg           NUMERIC CHECK (weight_kg > 0),
    activity_level      TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    bmr_deficit         NUMERIC  DEFAULT 0   CHECK (bmr_deficit >= 0),
    use_bmr_target      BOOLEAN  DEFAULT true,
    tdee_source         TEXT CHECK (tdee_source IN ('google-health')),
    tdee_calibrated_at  TIMESTAMPTZ,
    -- Eat-back
    eatback_enabled     BOOLEAN  DEFAULT true,
    eatback_pct         NUMERIC  DEFAULT 50  CHECK (eatback_pct >= 0 AND eatback_pct <= 100),
    -- App behaviour
    claude_draft_confirm  BOOLEAN  DEFAULT true,
    conflict_preference   TEXT     DEFAULT 'strava' CHECK (conflict_preference IN ('strava', 'google-health', 'manual')),
    -- Strava integration
    strava_auto_push        BOOLEAN DEFAULT false,
    strava_auto_push_google BOOLEAN DEFAULT false,
    strava_sync_paused      BOOLEAN DEFAULT false,
    strava_weight_sync      BOOLEAN DEFAULT false,
    -- Google Health integration
    gh_auto_push        BOOLEAN DEFAULT false,
    gh_sync_paused      BOOLEAN DEFAULT false,
    gh_push_strava      BOOLEAN DEFAULT false,
    -- Supplement tracking
    track_supplements   BOOLEAN DEFAULT false,
    creatine_target_g   NUMERIC DEFAULT 5 CHECK (creatine_target_g > 0),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

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

-- ── Approved Users / Signup Whitelist ────────────────────────────────────

CREATE TABLE public.allowed_users (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- IMPORTANT: Uncomment the line below and change to your actual GitHub email
-- BEFORE running this migration, or you will lock yourself out!
-- INSERT INTO public.allowed_users (email) VALUES (lower('your_actual_email@example.com'));

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.allowed_users
        WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    ) THEN
        RETURN true;
    END IF;

    RAISE EXCEPTION 'Access rejected by Supabase: email % is not approved.', coalesce(auth.jwt() ->> 'email', 'unknown');
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_approved_user()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.allowed_users
        WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    ) THEN
        RETURN;
    END IF;

    RAISE EXCEPTION 'Access rejected by Supabase: email % is not approved.', coalesce(auth.jwt() ->> 'email', 'unknown');
END;
$$;

-- ── Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE public.food_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_presets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_presets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own food entries"
    ON public.food_entries FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

CREATE POLICY "Users manage own workout entries"
    ON public.workout_entries FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

CREATE POLICY "Users manage own weight entries"
    ON public.weight_entries FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

CREATE POLICY "Users manage own meal presets"
    ON public.meal_presets FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

CREATE POLICY "Users manage own workout presets"
    ON public.workout_presets FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

CREATE POLICY "Users manage own settings"
    ON public.user_settings FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

CREATE POLICY "Users manage own integrations"
    ON public.user_integrations FOR ALL TO authenticated
    USING (auth.uid() = user_id AND public.is_approved_user()) WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

-- ── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX idx_food_entries_user_date    ON public.food_entries (user_id, date);
CREATE INDEX idx_workout_entries_user_date ON public.workout_entries (user_id, date);
CREATE INDEX idx_weight_entries_user_date  ON public.weight_entries (user_id, date);

CREATE OR REPLACE FUNCTION public.check_whitelist()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.allowed_users
        WHERE lower(email) = lower(NEW.email)
    ) THEN
        RAISE EXCEPTION 'Signup disabled: Email % is not on the whitelist.', NEW.email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_whitelist ON auth.users;
CREATE TRIGGER enforce_whitelist
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.check_whitelist();

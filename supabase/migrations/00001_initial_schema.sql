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
    meal        TEXT CHECK (meal IN ('breakfast', 'lunch', 'snack', 'dinner')),
    created_at  TIMESTAMPTZ DEFAULT now()
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
    distance        NUMERIC,
    heart_rate_avg  NUMERIC CHECK (heart_rate_avg >= 0),
    duration        TEXT,
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
    cal_rest       NUMERIC CHECK (cal_rest > 0),
    cal_training   NUMERIC CHECK (cal_training > 0),
    protein_g      NUMERIC CHECK (protein_g >= 0),
    carbs_g        NUMERIC CHECK (carbs_g >= 0),
    fat_g          NUMERIC CHECK (fat_g >= 0),
    age_years      INTEGER CHECK (age_years >= 0),
    sex            TEXT CHECK (sex IN ('female', 'male', 'other')),
    height_cm      NUMERIC CHECK (height_cm > 0),
    weight_kg      NUMERIC CHECK (weight_kg > 0),
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ── Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE public.food_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_presets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own food entries"
    ON public.food_entries FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own workout entries"
    ON public.workout_entries FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own weight entries"
    ON public.weight_entries FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own meal presets"
    ON public.meal_presets FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own workout presets"
    ON public.workout_presets FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own settings"
    ON public.user_settings FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX idx_food_entries_user_date    ON public.food_entries (user_id, date);
CREATE INDEX idx_workout_entries_user_date ON public.workout_entries (user_id, date);
CREATE INDEX idx_weight_entries_user_date  ON public.weight_entries (user_id, date);

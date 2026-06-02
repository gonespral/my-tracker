-- Supplement tracking: add creatine support to food_entries and user_settings

-- Allow 'supplement' as a meal category
ALTER TABLE public.food_entries
  DROP CONSTRAINT IF EXISTS food_entries_meal_check;

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_meal_check
    CHECK (meal IN ('breakfast', 'lunch', 'snack', 'dinner', 'supplement'));

-- Store supplement dose (g for creatine)
ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS supplement_dose_g NUMERIC CHECK (supplement_dose_g >= 0);

-- User settings: supplement tracking toggle + creatine daily target
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS track_supplements BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS creatine_target_g NUMERIC DEFAULT 5 CHECK (creatine_target_g > 0);

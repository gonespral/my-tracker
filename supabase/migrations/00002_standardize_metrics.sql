-- Migrate data from duration to duration_min where possible
UPDATE public.workout_entries 
SET duration_min = CAST(duration AS NUMERIC) 
WHERE duration_min IS NULL AND duration ~ '^[0-9]+(\.[0-9]+)?$';

-- Migrate distance (meters) to distance_km (kilometers)
UPDATE public.workout_entries 
SET distance_km = distance / 1000.0 
WHERE distance IS NOT NULL AND distance_km IS NULL;

-- Drop redundant columns
ALTER TABLE public.workout_entries 
DROP COLUMN IF EXISTS duration,
DROP COLUMN IF EXISTS distance;

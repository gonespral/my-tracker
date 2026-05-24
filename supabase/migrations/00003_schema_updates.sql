-- Add activity_type if it doesn't exist (if the user started before it was added to initial_schema)
ALTER TABLE public.workout_entries ADD COLUMN IF NOT EXISTS activity_type TEXT;

-- Drop redundant cal_training setting
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS cal_training;

-- Reload Supabase API schema cache to make sure the frontend sees the changes immediately
NOTIFY pgrst, 'reload schema';

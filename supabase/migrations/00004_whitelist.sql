-- Create a table for allowed emails
CREATE TABLE public.allowed_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- IMPORTANT: Uncomment the line below and change to your actual GitHub email 
-- BEFORE running this migration, or you will lock yourself out!
-- INSERT INTO public.allowed_emails (email) VALUES ('your_actual_email@example.com');


-- Enable RLS on the table (only admins/service role should be able to modify this)
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for all authenticated users" ON public.allowed_emails FOR SELECT TO authenticated USING (true);

-- Create a trigger function that checks the whitelist before inserting into auth.users
CREATE OR REPLACE FUNCTION public.check_whitelist()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the new user's email exists in the allowed_emails table
    IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) THEN
        -- If it doesn't exist, block the account creation
        RAISE EXCEPTION 'Signup disabled: Email % is not on the whitelist.', NEW.email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to the Supabase auth.users table
DROP TRIGGER IF EXISTS enforce_whitelist ON auth.users;
CREATE TRIGGER enforce_whitelist
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.check_whitelist();

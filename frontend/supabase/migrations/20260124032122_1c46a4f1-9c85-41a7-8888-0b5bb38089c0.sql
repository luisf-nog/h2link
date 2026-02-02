-- Add resume_data to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS resume_data jsonb;

-- Optional: ensure it defaults to NULL (no default)
ALTER TABLE public.profiles
ALTER COLUMN resume_data DROP DEFAULT;

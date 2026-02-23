
-- Add dual resume storage columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS resume_data_h2a jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resume_data_h2b jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resume_url_h2a text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resume_url_h2b text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resume_extra_context jsonb DEFAULT NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

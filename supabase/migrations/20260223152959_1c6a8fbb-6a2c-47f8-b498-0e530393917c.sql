
-- Add ai_summary column to profiles to cache the AI-generated summary
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_summary jsonb DEFAULT NULL;

-- Allow anon to read ai_summary (already covered by existing SELECT policies)
NOTIFY pgrst, 'reload schema';

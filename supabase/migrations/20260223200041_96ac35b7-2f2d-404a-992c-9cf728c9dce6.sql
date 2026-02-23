ALTER TABLE public.manual_jobs
ADD COLUMN IF NOT EXISTS preferred_resume_category text;
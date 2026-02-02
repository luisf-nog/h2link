ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS openings integer,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS overtime_salary numeric,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS experience_months integer,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS education_required text,
  ADD COLUMN IF NOT EXISTS worksite_address text,
  ADD COLUMN IF NOT EXISTS worksite_zip text;

-- Useful indexes for filters/search
CREATE INDEX IF NOT EXISTS idx_public_jobs_job_id ON public.public_jobs (job_id);
CREATE INDEX IF NOT EXISTS idx_public_jobs_posted_date ON public.public_jobs (posted_date);


-- Add randomization_group column to public_jobs
ALTER TABLE public.public_jobs
ADD COLUMN IF NOT EXISTS randomization_group TEXT;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_public_jobs_randomization_group ON public.public_jobs (randomization_group);

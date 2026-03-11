
ALTER TABLE public.sponsored_jobs
  ADD COLUMN IF NOT EXISTS returning_worker text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS previous_h2_visa text NOT NULL DEFAULT 'not_required';

COMMENT ON COLUMN public.sponsored_jobs.returning_worker IS 'Returning H-2 worker preference: not_required, preferred, required';
COMMENT ON COLUMN public.sponsored_jobs.previous_h2_visa IS 'Previous H-2 visa experience preference: not_required, preferred, required';

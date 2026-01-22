-- Add visa_type to public_jobs for H-2B vs H-2A support
ALTER TABLE public.public_jobs
ADD COLUMN IF NOT EXISTS visa_type text;

-- Backfill existing rows to H-2B (assume current dataset is H-2B)
UPDATE public.public_jobs
SET visa_type = 'H-2B'
WHERE visa_type IS NULL;

-- Ensure new rows default to H-2B
ALTER TABLE public.public_jobs
ALTER COLUMN visa_type SET DEFAULT 'H-2B';

-- Keep values normalized (use a validation trigger, not a CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_public_jobs_visa_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.visa_type IS NULL THEN
    NEW.visa_type := 'H-2B';
  END IF;

  IF NEW.visa_type NOT IN ('H-2B', 'H-2A') THEN
    RAISE EXCEPTION 'Invalid visa_type: %. Allowed: H-2B, H-2A', NEW.visa_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_public_jobs_visa_type ON public.public_jobs;
CREATE TRIGGER trg_validate_public_jobs_visa_type
BEFORE INSERT OR UPDATE ON public.public_jobs
FOR EACH ROW
EXECUTE FUNCTION public.validate_public_jobs_visa_type();

-- Helpful index for filtering in /jobs
CREATE INDEX IF NOT EXISTS idx_public_jobs_visa_type ON public.public_jobs (visa_type);

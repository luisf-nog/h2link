-- Create a private table for user-entered jobs (manual jobs)
CREATE TABLE IF NOT EXISTS public.manual_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  email TEXT NOT NULL,
  eta_number TEXT NULL,
  phone TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manual_jobs_user_id_created_at ON public.manual_jobs (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.manual_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manual_jobs' AND policyname = 'Users can view own manual jobs'
  ) THEN
    CREATE POLICY "Users can view own manual jobs"
    ON public.manual_jobs
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manual_jobs' AND policyname = 'Users can create own manual jobs'
  ) THEN
    CREATE POLICY "Users can create own manual jobs"
    ON public.manual_jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manual_jobs' AND policyname = 'Users can update own manual jobs'
  ) THEN
    CREATE POLICY "Users can update own manual jobs"
    ON public.manual_jobs
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manual_jobs' AND policyname = 'Users can delete own manual jobs'
  ) THEN
    CREATE POLICY "Users can delete own manual jobs"
    ON public.manual_jobs
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Validations (server-side)
CREATE OR REPLACE FUNCTION public.validate_manual_jobs_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.company := trim(NEW.company);
  NEW.job_title := trim(NEW.job_title);
  NEW.email := lower(trim(NEW.email));

  IF NEW.company = '' THEN
    RAISE EXCEPTION 'company cannot be empty';
  END IF;

  IF NEW.job_title = '' THEN
    RAISE EXCEPTION 'job_title cannot be empty';
  END IF;

  IF NEW.email = '' THEN
    RAISE EXCEPTION 'email cannot be empty';
  END IF;

  IF length(NEW.company) > 120 THEN
    RAISE EXCEPTION 'company too long (max 120)';
  END IF;

  IF length(NEW.job_title) > 120 THEN
    RAISE EXCEPTION 'job_title too long (max 120)';
  END IF;

  IF length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'email too long (max 255)';
  END IF;

  IF NEW.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'invalid email format';
  END IF;

  IF NEW.eta_number IS NOT NULL THEN
    NEW.eta_number := trim(NEW.eta_number);
    IF NEW.eta_number = '' THEN
      NEW.eta_number := NULL;
    ELSIF length(NEW.eta_number) > 64 THEN
      RAISE EXCEPTION 'eta_number too long (max 64)';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL THEN
    NEW.phone := trim(NEW.phone);
    IF NEW.phone = '' THEN
      NEW.phone := NULL;
    ELSIF length(NEW.phone) > 32 THEN
      RAISE EXCEPTION 'phone too long (max 32)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_manual_jobs_fields_trigger ON public.manual_jobs;
CREATE TRIGGER validate_manual_jobs_fields_trigger
BEFORE INSERT OR UPDATE ON public.manual_jobs
FOR EACH ROW
EXECUTE FUNCTION public.validate_manual_jobs_fields();

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS update_manual_jobs_updated_at ON public.manual_jobs;
CREATE TRIGGER update_manual_jobs_updated_at
BEFORE UPDATE ON public.manual_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Extend queue to optionally reference a manual job
ALTER TABLE public.my_queue
ADD COLUMN IF NOT EXISTS manual_job_id UUID NULL;

-- Foreign key (manual job deletion removes queue entries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'my_queue'
      AND constraint_name = 'my_queue_manual_job_id_fkey'
  ) THEN
    ALTER TABLE public.my_queue
    ADD CONSTRAINT my_queue_manual_job_id_fkey
    FOREIGN KEY (manual_job_id)
    REFERENCES public.manual_jobs (id)
    ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_my_queue_manual_job_id ON public.my_queue (manual_job_id);

-- Validate that each queue row references exactly one job source
CREATE OR REPLACE FUNCTION public.validate_my_queue_job_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.job_id IS NULL AND NEW.manual_job_id IS NULL) OR (NEW.job_id IS NOT NULL AND NEW.manual_job_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Queue item must reference exactly one of job_id or manual_job_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_my_queue_job_reference_trigger ON public.my_queue;
CREATE TRIGGER validate_my_queue_job_reference_trigger
BEFORE INSERT OR UPDATE ON public.my_queue
FOR EACH ROW
EXECUTE FUNCTION public.validate_my_queue_job_reference();

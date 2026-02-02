-- 1) Roles (admin) infrastructure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users can view own roles'
  ) THEN
    CREATE POLICY "Users can view own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Security definer role check (avoids recursive RLS lookups)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 2) Make public_jobs safe for upsert by ensuring a unique key
-- De-dupe by (job_id, visa_type): keep the most recent posted_date/created_at
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY job_id, COALESCE(visa_type, 'H-2B')
      ORDER BY posted_date DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.public_jobs
)
DELETE FROM public.public_jobs pj
USING ranked r
WHERE pj.id = r.id
  AND r.rn > 1;

-- Unique index for upsert semantics
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_jobs_job_id_visa
ON public.public_jobs (job_id, visa_type);

-- Helpful filter indexes (if not already present)
CREATE INDEX IF NOT EXISTS idx_public_jobs_state ON public.public_jobs (state);
CREATE INDEX IF NOT EXISTS idx_public_jobs_city ON public.public_jobs (city);
CREATE INDEX IF NOT EXISTS idx_public_jobs_category ON public.public_jobs (category);
CREATE INDEX IF NOT EXISTS idx_public_jobs_salary ON public.public_jobs (salary);

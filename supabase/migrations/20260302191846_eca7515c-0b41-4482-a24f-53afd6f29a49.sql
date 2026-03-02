
-- B2B Pivot: Full schema

-- 1. Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_tier') THEN
    CREATE TYPE public.employer_tier AS ENUM ('essential', 'professional', 'enterprise');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_status') THEN
    CREATE TYPE public.employer_status AS ENUM ('active', 'inactive');
  END IF;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employer';

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.employer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  tier employer_tier NOT NULL DEFAULT 'essential',
  is_verified boolean NOT NULL DEFAULT false,
  contact_email text,
  contact_phone text,
  status employer_status NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employer_profiles_user_id ON public.employer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employer_profiles_tier ON public.employer_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_employer_profiles_status ON public.employer_profiles(status);

CREATE TABLE IF NOT EXISTS public.sponsored_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  is_sponsored boolean NOT NULL DEFAULT true,
  priority_level text NOT NULL DEFAULT 'essential' CHECK (priority_level IN ('free','essential','professional','enterprise')),
  req_english boolean NOT NULL DEFAULT false,
  req_experience boolean NOT NULL DEFAULT false,
  req_drivers_license boolean NOT NULL DEFAULT false,
  consular_only boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_jobs_employer_id ON public.sponsored_jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_jobs_is_active ON public.sponsored_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_sponsored_jobs_priority ON public.sponsored_jobs(priority_level);
CREATE INDEX IF NOT EXISTS idx_sponsored_jobs_created ON public.sponsored_jobs(created_at);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.sponsored_jobs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  has_english boolean NOT NULL DEFAULT false,
  has_experience boolean NOT NULL DEFAULT false,
  has_license boolean NOT NULL DEFAULT false,
  is_in_us boolean NOT NULL DEFAULT false,
  citizenship_status text NOT NULL DEFAULT 'other' CHECK (citizenship_status IN ('us_citizen','permanent_resident','h2_applicant','other')),
  employer_status text NOT NULL DEFAULT 'new' CHECK (employer_status IN ('new','contacted','rejected')),
  rejection_reason text,
  score_color text CHECK (score_color IN ('green','yellow','red')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_email_per_job UNIQUE (email, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_apps_job ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_status ON public.job_applications(employer_status);
CREATE INDEX IF NOT EXISTS idx_job_apps_citizen ON public.job_applications(citizenship_status);
CREATE INDEX IF NOT EXISTS idx_job_apps_created ON public.job_applications(created_at);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.sponsored_jobs(id),
  application_id uuid REFERENCES public.job_applications(id),
  employer_id uuid REFERENCES public.employer_profiles(id),
  action text NOT NULL CHECK (action IN ('contacted','rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_employer ON public.audit_logs(employer_id);
CREATE INDEX IF NOT EXISTS idx_audit_job ON public.audit_logs(job_id);

-- 3. RLS
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- employer_profiles
CREATE POLICY "ep_select_own" ON public.employer_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ep_update_own" ON public.employer_profiles FOR UPDATE USING (auth.uid() = user_id);

-- sponsored_jobs
CREATE POLICY "sj_employer_all" ON public.sponsored_jobs FOR ALL USING (employer_id IN (SELECT id FROM public.employer_profiles WHERE user_id = auth.uid()));
CREATE POLICY "sj_public_read" ON public.sponsored_jobs FOR SELECT USING (is_active = true);

-- job_applications
CREATE POLICY "ja_public_insert" ON public.job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "ja_employer_select" ON public.job_applications FOR SELECT USING (job_id IN (SELECT sj.id FROM public.sponsored_jobs sj JOIN public.employer_profiles ep ON ep.id = sj.employer_id WHERE ep.user_id = auth.uid()));
CREATE POLICY "ja_employer_update" ON public.job_applications FOR UPDATE USING (job_id IN (SELECT sj.id FROM public.sponsored_jobs sj JOIN public.employer_profiles ep ON ep.id = sj.employer_id WHERE ep.user_id = auth.uid()));
CREATE POLICY "ja_no_delete" ON public.job_applications FOR DELETE USING (false);

-- audit_logs
CREATE POLICY "al_employer_select" ON public.audit_logs FOR SELECT USING (employer_id IN (SELECT id FROM public.employer_profiles WHERE user_id = auth.uid()));
CREATE POLICY "al_no_insert" ON public.audit_logs FOR INSERT WITH CHECK (false);
CREATE POLICY "al_no_update" ON public.audit_logs FOR UPDATE USING (false);
CREATE POLICY "al_no_delete" ON public.audit_logs FOR DELETE USING (false);

-- 4. Functions
CREATE OR REPLACE FUNCTION public.check_employer_job_limit(p_employer_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tier employer_tier; v_max integer; v_current integer;
BEGIN
  SELECT tier INTO v_tier FROM employer_profiles WHERE id = p_employer_id;
  CASE v_tier WHEN 'essential' THEN v_max := 1; WHEN 'professional' THEN v_max := 3; WHEN 'enterprise' THEN v_max := 5; ELSE v_max := 0; END CASE;
  SELECT COUNT(*) INTO v_current FROM sponsored_jobs WHERE employer_id = p_employer_id AND is_active = true;
  RETURN v_current < v_max;
END; $$;

CREATE OR REPLACE FUNCTION public.compute_application_score(
  p_has_english boolean, p_has_experience boolean, p_has_license boolean,
  p_is_in_us boolean, p_req_english boolean, p_req_experience boolean,
  p_req_drivers_license boolean, p_consular_only boolean
) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF p_consular_only AND p_is_in_us THEN RETURN 'red'; END IF;
  IF p_req_english AND NOT p_has_english THEN RETURN 'red'; END IF;
  IF (NOT p_req_experience OR p_has_experience) AND (NOT p_req_drivers_license OR p_has_license) THEN RETURN 'green'; END IF;
  RETURN 'yellow';
END; $$;

CREATE OR REPLACE FUNCTION public.deactivate_employer_jobs(p_employer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE sponsored_jobs SET is_sponsored = false, priority_level = 'free' WHERE employer_id = p_employer_id AND is_active = true;
END; $$;

CREATE OR REPLACE FUNCTION public.insert_audit_log(p_job_id uuid, p_application_id uuid, p_employer_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO audit_logs (job_id, application_id, employer_id, action, reason) VALUES (p_job_id, p_application_id, p_employer_id, p_action, p_reason) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- 5. Trigger
CREATE TRIGGER update_employer_profiles_updated_at BEFORE UPDATE ON public.employer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 1. Add new structured fields to job_applications
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS work_authorization_status text NOT NULL DEFAULT 'outside_us',
  ADD COLUMN IF NOT EXISTS is_us_worker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS months_experience integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS english_level text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS drivers_license_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS h2b_visa_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS application_match_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS application_status text NOT NULL DEFAULT 'received';

-- 2. Create candidate_experience table
CREATE TABLE IF NOT EXISTS public.candidate_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  job_title text NOT NULL,
  duration_months integer NOT NULL DEFAULT 0,
  tasks_description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_experience ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public application flow)
CREATE POLICY "ce_public_insert" ON public.candidate_experience FOR INSERT WITH CHECK (true);
-- Employers can view experience for their job applications
CREATE POLICY "ce_employer_select" ON public.candidate_experience FOR SELECT
  USING (application_id IN (
    SELECT ja.id FROM job_applications ja
    JOIN sponsored_jobs sj ON sj.id = ja.job_id
    JOIN employer_profiles ep ON ep.id = sj.employer_id
    WHERE ep.user_id = auth.uid()
  ));
-- No update/delete
CREATE POLICY "ce_no_update" ON public.candidate_experience FOR UPDATE USING (false);
CREATE POLICY "ce_no_delete" ON public.candidate_experience FOR DELETE USING (false);

-- 3. Create application_audit_log table (immutable compliance log)
CREATE TABLE IF NOT EXISTS public.application_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE RESTRICT,
  changed_by_user_id uuid NOT NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_audit_log ENABLE ROW LEVEL SECURITY;

-- Employers can view their own audit logs
CREATE POLICY "aal_employer_select" ON public.application_audit_log FOR SELECT
  USING (application_id IN (
    SELECT ja.id FROM job_applications ja
    JOIN sponsored_jobs sj ON sj.id = ja.job_id
    JOIN employer_profiles ep ON ep.id = sj.employer_id
    WHERE ep.user_id = auth.uid()
  ));
-- Employers can insert audit logs for their applications
CREATE POLICY "aal_employer_insert" ON public.application_audit_log FOR INSERT
  WITH CHECK (
    changed_by_user_id = auth.uid()
    AND application_id IN (
      SELECT ja.id FROM job_applications ja
      JOIN sponsored_jobs sj ON sj.id = ja.job_id
      JOIN employer_profiles ep ON ep.id = sj.employer_id
      WHERE ep.user_id = auth.uid()
    )
  );
-- Immutable: no update or delete
CREATE POLICY "aal_no_update" ON public.application_audit_log FOR UPDATE USING (false);
CREATE POLICY "aal_no_delete" ON public.application_audit_log FOR DELETE USING (false);

-- 4. Create match score computation function
CREATE OR REPLACE FUNCTION public.compute_match_score(
  p_months_experience integer,
  p_english_level text,
  p_drivers_license_type text,
  p_h2b_visa_count integer,
  p_work_authorization_status text,
  p_is_us_worker boolean,
  p_req_english boolean,
  p_req_experience boolean,
  p_req_drivers_license boolean,
  p_consular_only boolean
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  score integer := 0;
  exp_score integer := 0;
  eng_score integer := 0;
  lic_score integer := 0;
  visa_score integer := 0;
  auth_score integer := 0;
  status text;
BEGIN
  -- Experience: 40% (0-40 points)
  IF p_months_experience >= 24 THEN exp_score := 40;
  ELSIF p_months_experience >= 12 THEN exp_score := 30;
  ELSIF p_months_experience >= 6 THEN exp_score := 20;
  ELSIF p_months_experience >= 3 THEN exp_score := 10;
  ELSE exp_score := 0;
  END IF;

  -- English: 20% (0-20 points)
  CASE p_english_level
    WHEN 'fluent' THEN eng_score := 20;
    WHEN 'advanced' THEN eng_score := 16;
    WHEN 'intermediate' THEN eng_score := 12;
    WHEN 'basic' THEN eng_score := 6;
    ELSE eng_score := 0;
  END CASE;

  -- Driver's License: 15% (0-15 points)
  CASE p_drivers_license_type
    WHEN 'both' THEN lic_score := 15;
    WHEN 'us' THEN lic_score := 15;
    WHEN 'foreign' THEN lic_score := 8;
    ELSE lic_score := 0;
  END CASE;

  -- Visa History: 15% (0-15 points)
  IF p_h2b_visa_count >= 3 THEN visa_score := 15;
  ELSIF p_h2b_visa_count >= 1 THEN visa_score := 10;
  ELSE visa_score := 0;
  END IF;

  -- Work Authorization: 10% (0-10 points)
  CASE p_work_authorization_status
    WHEN 'us_authorized' THEN auth_score := 10;
    WHEN 'requires_sponsorship' THEN auth_score := 5;
    ELSE auth_score := 3;
  END CASE;

  score := exp_score + eng_score + lic_score + visa_score + auth_score;

  -- Determine status
  -- Red: hard disqualifiers
  IF p_consular_only AND p_work_authorization_status = 'us_authorized' THEN
    status := 'red';
  ELSIF p_req_english AND p_english_level = 'none' THEN
    status := 'red';
  ELSIF p_req_experience AND p_months_experience = 0 THEN
    status := 'red';
  ELSIF p_req_drivers_license AND p_drivers_license_type = 'none' THEN
    status := 'red';
  ELSIF score >= 60 THEN
    status := 'green';
  ELSIF score >= 30 THEN
    status := 'yellow';
  ELSE
    status := 'red';
  END IF;

  RETURN jsonb_build_object('score', score, 'status', status);
END;
$$;

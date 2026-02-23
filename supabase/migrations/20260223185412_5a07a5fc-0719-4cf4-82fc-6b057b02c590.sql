
-- RPC that resolves the best resume_url for a Smart Profile view
-- Given a profile token and optional queue_id, returns the most relevant resume URL
CREATE OR REPLACE FUNCTION public.resolve_profile_resume_url(p_token text, p_queue_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_plan_tier plan_tier;
  v_resume_url text;
  v_resume_url_h2a text;
  v_resume_url_h2b text;
  v_job_category text;
  v_job_visa_type text;
  v_normalized_category text;
  v_sector_resume_url text;
BEGIN
  -- 1. Find profile
  SELECT id, plan_tier, resume_url, resume_url_h2a, resume_url_h2b
  INTO v_profile_id, v_plan_tier, v_resume_url, v_resume_url_h2a, v_resume_url_h2b
  FROM profiles
  WHERE public_token::text = p_token;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. If no queue_id, use visa-specific fallback logic
  IF p_queue_id IS NULL THEN
    RETURN COALESCE(v_resume_url_h2b, v_resume_url_h2a, v_resume_url);
  END IF;

  -- 3. Get job info from queue
  SELECT j.category, j.visa_type
  INTO v_job_category, v_job_visa_type
  FROM my_queue q
  JOIN public_jobs j ON j.id = q.job_id
  WHERE q.id = p_queue_id;

  -- If no job found (manual job or missing), use visa fallback
  IF v_job_category IS NULL THEN
    RETURN COALESCE(v_resume_url_h2b, v_resume_url_h2a, v_resume_url);
  END IF;

  -- 4. For Black tier: try sector-specific resume
  IF v_plan_tier = 'black' THEN
    v_normalized_category := get_normalized_category(v_job_category);
    
    SELECT sr.resume_url INTO v_sector_resume_url
    FROM sector_resumes sr
    WHERE sr.user_id = v_profile_id
      AND sr.category = v_normalized_category
      AND sr.resume_url IS NOT NULL
    LIMIT 1;

    IF v_sector_resume_url IS NOT NULL THEN
      RETURN v_sector_resume_url;
    END IF;
  END IF;

  -- 5. Visa-specific fallback
  IF v_job_visa_type IS NOT NULL AND (v_job_visa_type = 'H-2A' OR v_job_visa_type LIKE 'H-2A%') THEN
    RETURN COALESCE(v_resume_url_h2a, v_resume_url);
  ELSE
    RETURN COALESCE(v_resume_url_h2b, v_resume_url);
  END IF;
END;
$$;

-- Grant execute to anon and authenticated so Smart Profile works for recruiters
GRANT EXECUTE ON FUNCTION public.resolve_profile_resume_url(text, uuid) TO anon, authenticated;

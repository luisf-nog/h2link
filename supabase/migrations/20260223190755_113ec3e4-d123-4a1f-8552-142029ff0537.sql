
-- RPC that resolves the correct resume DATA (JSON) for a given token + queueId
-- Used by Smart Profile to generate PDF client-side when no pre-built PDF URL exists
CREATE OR REPLACE FUNCTION public.resolve_profile_resume_data(p_token text, p_queue_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_plan_tier plan_tier;
  v_resume_data jsonb;
  v_resume_data_h2a jsonb;
  v_resume_data_h2b jsonb;
  v_job_category text;
  v_job_visa_type text;
  v_normalized_category text;
  v_sector_resume_data jsonb;
BEGIN
  -- 1. Find profile
  SELECT id, plan_tier, resume_data, resume_data_h2a, resume_data_h2b
  INTO v_profile_id, v_plan_tier, v_resume_data, v_resume_data_h2a, v_resume_data_h2b
  FROM profiles
  WHERE public_token::text = p_token;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. If no queue_id, use visa-specific fallback
  IF p_queue_id IS NULL THEN
    RETURN COALESCE(v_resume_data_h2b, v_resume_data_h2a, v_resume_data);
  END IF;

  -- 3. Get job info from queue
  SELECT j.category, j.visa_type
  INTO v_job_category, v_job_visa_type
  FROM my_queue q
  JOIN public_jobs j ON j.id = q.job_id
  WHERE q.id = p_queue_id;

  -- If no job found (manual job or missing), use visa fallback
  IF v_job_category IS NULL THEN
    RETURN COALESCE(v_resume_data_h2b, v_resume_data_h2a, v_resume_data);
  END IF;

  -- 4. For Black tier: try sector-specific resume data
  IF v_plan_tier = 'black' THEN
    v_normalized_category := get_normalized_category(v_job_category);
    
    SELECT sr.resume_data INTO v_sector_resume_data
    FROM sector_resumes sr
    WHERE sr.user_id = v_profile_id
      AND sr.category = v_normalized_category
      AND sr.resume_data IS NOT NULL
    LIMIT 1;

    IF v_sector_resume_data IS NOT NULL THEN
      RETURN v_sector_resume_data;
    END IF;
  END IF;

  -- 5. Visa-specific fallback
  IF v_job_visa_type IS NOT NULL AND (v_job_visa_type = 'H-2A' OR v_job_visa_type LIKE 'H-2A%') THEN
    RETURN COALESCE(v_resume_data_h2a, v_resume_data);
  ELSE
    RETURN COALESCE(v_resume_data_h2b, v_resume_data);
  END IF;
END;
$$;

-- Grant access to anon for public Smart Profile access
GRANT EXECUTE ON FUNCTION public.resolve_profile_resume_data(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_profile_resume_data(text, uuid) TO authenticated;

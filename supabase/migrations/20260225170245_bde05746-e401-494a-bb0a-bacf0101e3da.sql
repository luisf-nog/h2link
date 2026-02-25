
-- Fix trigger_immediate_radar: use salary instead of wage_from (wage_from is always null)
CREATE OR REPLACE FUNCTION public.trigger_immediate_radar(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_count integer := 0;
  v_auto_send boolean := false;
BEGIN
  SELECT COALESCE(rp.auto_send, false)
  INTO v_auto_send
  FROM public.radar_profiles rp
  WHERE rp.user_id = target_user_id;

  DELETE FROM public.radar_matched_jobs
  WHERE user_id = target_user_id;

  WITH inserted_matches AS (
    INSERT INTO public.radar_matched_jobs (user_id, job_id, auto_queued)
    SELECT p.user_id, j.id, v_auto_send
    FROM public.radar_profiles p
    JOIN public.public_jobs j ON (
      j.category = ANY(p.categories)
      AND (p.visa_type IS NULL OR p.visa_type = 'all' OR j.visa_type = p.visa_type)
      AND (p.state IS NULL OR p.state = 'all' OR j.state = p.state)
      AND (COALESCE(j.salary, 0) >= COALESCE(p.min_wage, 0))
      AND (p.max_experience IS NULL OR COALESCE(j.experience_months, 0) <= p.max_experience)
      AND (p.randomization_group = 'all' OR p.randomization_group IS NULL OR j.randomization_group = p.randomization_group)
    )
    WHERE p.user_id = target_user_id
      AND p.is_active = true
      AND j.is_active = true
      AND j.is_banned = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.my_queue mq
        WHERE mq.job_id = j.id
          AND mq.user_id = target_user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_reports jr
        WHERE jr.job_id = j.id
      )
    ON CONFLICT (user_id, job_id) DO UPDATE
      SET auto_queued = EXCLUDED.auto_queued
    RETURNING job_id
  ), queued_rows AS (
    INSERT INTO public.my_queue (user_id, job_id, status)
    SELECT target_user_id, im.job_id, 'pending'
    FROM inserted_matches im
    WHERE v_auto_send
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO matched_count
  FROM inserted_matches;

  RETURN matched_count;
END;
$$;

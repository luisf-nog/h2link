
-- Function to deactivate jobs whose start_date is within 5 days or already past
-- This preserves all jobs in the database but marks expired ones as inactive
CREATE OR REPLACE FUNCTION public.deactivate_expired_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.public_jobs
  SET is_active = false
  WHERE is_active = true
    AND start_date IS NOT NULL
    AND start_date <= (CURRENT_DATE + INTERVAL '5 days');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


CREATE OR REPLACE FUNCTION public.increment_sponsored_job_view(p_job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sponsored_jobs
  SET view_count = view_count + 1
  WHERE id = p_job_id AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_sponsored_job_view(uuid) TO anon, authenticated;

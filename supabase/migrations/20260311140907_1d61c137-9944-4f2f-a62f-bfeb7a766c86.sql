CREATE POLICY "Allow anonymous read access to active sponsored jobs"
ON public.sponsored_jobs
FOR SELECT
TO anon
USING (is_active = true);
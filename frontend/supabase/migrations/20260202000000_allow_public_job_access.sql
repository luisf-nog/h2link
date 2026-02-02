-- Allow anonymous (anon) users to view public_jobs for shared links
-- This enables the shared job view page to work without authentication

CREATE POLICY "Anonymous users can view jobs"
  ON public.public_jobs FOR SELECT
  TO anon
  USING (true);

-- Note: This doesn't affect security as public_jobs contains only publicly available
-- government job postings that should be accessible to everyone

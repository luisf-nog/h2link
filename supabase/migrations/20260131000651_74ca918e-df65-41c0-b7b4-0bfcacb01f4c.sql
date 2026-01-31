-- Update RLS policy for public_jobs to allow anonymous read access
-- Drop the existing policy that only allows authenticated users
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON public.public_jobs;

-- Create a new policy that allows anyone (including anonymous) to read jobs
CREATE POLICY "Anyone can view jobs" 
ON public.public_jobs 
FOR SELECT 
USING (true);

-- Note: Insert/Update/Delete policies remain unchanged (only admins can modify)

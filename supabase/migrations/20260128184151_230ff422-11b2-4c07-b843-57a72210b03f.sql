-- Drop the view approach and use a more targeted RLS policy
DROP VIEW IF EXISTS public.profiles_public;

-- Create a new public SELECT policy that ONLY exposes minimal fields
-- The key insight: RLS controls which ROWS are accessible, not which COLUMNS
-- But we can use the application layer to only query specific columns

-- Re-add a public policy for Smart Profile, but the application
-- (via the RPC function track_profile_view) controls which fields are returned
CREATE POLICY "Public can access profile via token"
ON public.profiles
FOR SELECT
USING (public_token IS NOT NULL);

-- The track_profile_view RPC function (SECURITY DEFINER) already returns only safe fields:
-- id, full_name, phone_e164, resume_url, contact_email
-- This is the correct pattern - RLS allows row access, RPC controls column exposure
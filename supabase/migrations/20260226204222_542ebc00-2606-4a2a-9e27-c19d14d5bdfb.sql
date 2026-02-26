
-- FIX 1: Remove overly permissive public SELECT policy on profiles
-- The Smart Profile feature uses SECURITY DEFINER RPCs (track_profile_view, track_profile_view_v2)
-- which bypass RLS, so this public policy is unnecessary and dangerous.
DROP POLICY IF EXISTS "Public can access profile via token" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profile by token" ON public.profiles;

-- FIX 2: Enable RLS on profile_views and add owner-only policy
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Profile owners can view their own profile views
CREATE POLICY "Users can view own profile views"
ON public.profile_views
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Deny all other operations from client
CREATE POLICY "profile_views_deny_insert"
ON public.profile_views
FOR INSERT
WITH CHECK (false);

CREATE POLICY "profile_views_deny_update"
ON public.profile_views
FOR UPDATE
USING (false);

CREATE POLICY "profile_views_deny_delete"
ON public.profile_views
FOR DELETE
USING (false);

-- FIX 3: Enable RLS on jobs_history (admin-only access)
ALTER TABLE public.jobs_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage jobs_history"
ON public.jobs_history
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "jobs_history_deny_anon"
ON public.jobs_history
FOR SELECT
TO anon
USING (false);

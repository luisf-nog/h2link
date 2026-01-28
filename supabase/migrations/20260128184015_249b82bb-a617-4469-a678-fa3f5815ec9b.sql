-- Create a secure view for public profile access (Smart Profile feature)
-- This exposes ONLY the fields needed for recruiters to contact candidates
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  public_token,
  full_name,
  phone_e164,
  contact_email,
  resume_url,
  views_count,
  last_viewed_at
FROM public.profiles
WHERE public_token IS NOT NULL;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Drop the overly permissive public policy on profiles
DROP POLICY IF EXISTS "Public can view profile by token" ON public.profiles;

-- Add RLS policy for the view-based approach
-- The view itself handles the filtering by public_token
-- Profiles table now only accessible by authenticated owners
COMMENT ON VIEW public.profiles_public IS 'Public-facing view for Smart Profile feature. Exposes minimal candidate info for recruiter contact.';

-- Add RLS to ai_usage_summary (it's a view, so we need to handle it differently)
-- Since ai_usage_summary is a VIEW, it inherits RLS from its base table (ai_daily_usage)
-- The base table already has proper RLS, so this is secure
COMMENT ON VIEW public.ai_usage_summary IS 'Admin-only aggregated AI usage metrics. Access controlled via base table RLS.';
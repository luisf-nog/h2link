-- Add public profile columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whatsapp_clicks INTEGER NOT NULL DEFAULT 0;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_public_token ON public.profiles(public_token);

-- Create RLS policy for public access via token (SELECT only)
CREATE POLICY "Public can view profile by token"
ON public.profiles
FOR SELECT
USING (public_token IS NOT NULL);

-- Function to track profile view (increments count and updates timestamp)
CREATE OR REPLACE FUNCTION public.track_profile_view(p_token UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone_e164 TEXT,
  resume_url TEXT,
  contact_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Find and update the profile
  UPDATE public.profiles
  SET views_count = views_count + 1,
      last_viewed_at = NOW()
  WHERE public_token = p_token
  RETURNING profiles.id INTO v_profile_id;

  -- Return profile data if found
  IF v_profile_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.phone_e164, p.resume_url, p.contact_email
    FROM public.profiles p
    WHERE p.id = v_profile_id;
  END IF;
END;
$$;

-- Function to track WhatsApp click
CREATE OR REPLACE FUNCTION public.track_whatsapp_click(p_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET whatsapp_clicks = whatsapp_clicks + 1
  WHERE public_token = p_token;
END;
$$;
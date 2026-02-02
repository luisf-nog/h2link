-- Add profile_viewed_at column to my_queue for per-item resume tracking
ALTER TABLE public.my_queue
ADD COLUMN IF NOT EXISTS profile_viewed_at TIMESTAMP WITH TIME ZONE;

-- Update track_profile_view to optionally update a queue item's profile_viewed_at
CREATE OR REPLACE FUNCTION public.track_profile_view(p_token UUID, p_queue_id UUID DEFAULT NULL)
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

  -- If queue_id provided, update the specific queue item's profile_viewed_at
  IF p_queue_id IS NOT NULL AND v_profile_id IS NOT NULL THEN
    UPDATE public.my_queue
    SET profile_viewed_at = NOW()
    WHERE my_queue.id = p_queue_id
      AND my_queue.user_id = v_profile_id
      AND profile_viewed_at IS NULL; -- Only set first view
  END IF;

  -- Return profile data if found
  IF v_profile_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.phone_e164, p.resume_url, p.contact_email
    FROM public.profiles p
    WHERE p.id = v_profile_id;
  END IF;
END;
$$;
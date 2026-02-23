
-- Recreate track_profile_view_v2 to refresh PostgREST schema cache
CREATE OR REPLACE FUNCTION public.track_profile_view_v2(p_token text, p_queue_id uuid DEFAULT NULL)
RETURNS TABLE(view_id uuid, id uuid, full_name text, phone_e164 text, resume_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_new_view_id UUID;
BEGIN
    SELECT p.id INTO v_profile_id FROM profiles p WHERE p.public_token::text = p_token;
    
    IF v_profile_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO profile_views (profile_id, queue_id, opened_at, duration_seconds)
    VALUES (v_profile_id, p_queue_id, now(), 0)
    RETURNING profile_views.id INTO v_new_view_id;

    -- Update profile stats
    UPDATE profiles SET views_count = views_count + 1, last_viewed_at = now() WHERE profiles.id = v_profile_id;

    -- Update queue profile_viewed_at if queue_id provided
    IF p_queue_id IS NOT NULL THEN
        UPDATE my_queue SET profile_viewed_at = now() WHERE my_queue.id = p_queue_id;
    END IF;

    RETURN QUERY 
    SELECT v_new_view_id, p.id, p.full_name, p.phone_e164, p.resume_url 
    FROM profiles p WHERE p.id = v_profile_id;
END;
$$;

-- Recreate update_view_duration
CREATE OR REPLACE FUNCTION public.update_view_duration(p_view_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE profile_views SET duration_seconds = duration_seconds + 10 WHERE id = p_view_id;
END;
$$;

-- Recreate track_whatsapp_click  
CREATE OR REPLACE FUNCTION public.track_whatsapp_click(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE profiles SET whatsapp_clicks = whatsapp_clicks + 1 WHERE public_token::text = p_token;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.track_profile_view_v2(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_view_duration(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_whatsapp_click(text) TO anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

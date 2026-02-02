-- Add denormalized fields for dashboard display
ALTER TABLE public.referral_links
  ADD COLUMN IF NOT EXISTS referred_name text,
  ADD COLUMN IF NOT EXISTS referred_email text;

-- Update helper to populate display fields
CREATE OR REPLACE FUNCTION public.ensure_referral_link_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    INSERT INTO public.referral_links (referrer_id, referred_id, referred_name, referred_email)
    VALUES (NEW.referred_by, NEW.id, NEW.full_name, NEW.email)
    ON CONFLICT (referrer_id, referred_id) DO UPDATE
      SET referred_name = EXCLUDED.referred_name,
          referred_email = EXCLUDED.referred_email;
  END IF;
  RETURN NEW;
END;
$$;

-- Also keep display fields fresh when child updates name/email
DROP TRIGGER IF EXISTS trg_profiles_referral_link_name_upd ON public.profiles;
CREATE TRIGGER trg_profiles_referral_link_name_upd
AFTER UPDATE OF full_name, email ON public.profiles
FOR EACH ROW
WHEN (NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION public.ensure_referral_link_row();

-- Add preferred language to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

-- Optional: keep values constrained via a lightweight trigger (not a CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_profiles_preferred_language()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.preferred_language IS NULL OR NEW.preferred_language = '' THEN
    NEW.preferred_language := 'en';
  END IF;

  IF NEW.preferred_language NOT IN ('en', 'pt', 'es') THEN
    RAISE EXCEPTION 'Invalid preferred_language: %. Allowed: en, pt, es', NEW.preferred_language;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profiles_preferred_language_trigger ON public.profiles;
CREATE TRIGGER validate_profiles_preferred_language_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profiles_preferred_language();

-- Backfill existing rows (safe with default but keeps explicit)
UPDATE public.profiles
SET preferred_language = COALESCE(NULLIF(preferred_language, ''), 'en')
WHERE preferred_language IS NULL OR preferred_language = '';

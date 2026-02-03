-- Add support for H-2A (Early Access) visa type
-- This allows importing jobs from the 790/790A feed with early access designation

CREATE OR REPLACE FUNCTION public.validate_public_jobs_visa_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.visa_type IS NULL THEN
    NEW.visa_type := 'H-2B';
  END IF;

  -- Now accepting: H-2B, H-2A, and H-2A (Early Access)
  IF NEW.visa_type NOT IN ('H-2B', 'H-2A', 'H-2A (Early Access)') THEN
    RAISE EXCEPTION 'Invalid visa_type: %. Allowed: H-2B, H-2A, H-2A (Early Access)', NEW.visa_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Add comment explaining the new type
COMMENT ON FUNCTION public.validate_public_jobs_visa_type() IS 
'Validates visa_type for public_jobs. Accepts: H-2B, H-2A, H-2A (Early Access). 
The Early Access variant indicates jobs from the 790/790A feed with JO designation.';

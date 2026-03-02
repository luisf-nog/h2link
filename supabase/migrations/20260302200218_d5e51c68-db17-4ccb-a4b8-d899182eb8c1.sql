
-- Add employer-specific registration fields to employer_profiles
ALTER TABLE public.employer_profiles
  ADD COLUMN IF NOT EXISTS legal_entity_name text,
  ADD COLUMN IF NOT EXISTS ein_tax_id text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS primary_hiring_location text,
  ADD COLUMN IF NOT EXISTS worker_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_monthly_volume text;

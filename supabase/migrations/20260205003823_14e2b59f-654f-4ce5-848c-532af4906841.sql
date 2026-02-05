-- Add new columns to public_jobs table for extended job information from the importer
ALTER TABLE public.public_jobs 
ADD COLUMN IF NOT EXISTS wage_from NUMERIC,
ADD COLUMN IF NOT EXISTS wage_to NUMERIC,
ADD COLUMN IF NOT EXISTS wage_unit TEXT DEFAULT 'Hour',
ADD COLUMN IF NOT EXISTS pay_frequency TEXT,
ADD COLUMN IF NOT EXISTS overtime_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS overtime_from NUMERIC,
ADD COLUMN IF NOT EXISTS overtime_to NUMERIC,
ADD COLUMN IF NOT EXISTS transport_min_reimburse NUMERIC,
ADD COLUMN IF NOT EXISTS transport_max_reimburse NUMERIC,
ADD COLUMN IF NOT EXISTS transport_desc TEXT,
ADD COLUMN IF NOT EXISTS housing_type TEXT,
ADD COLUMN IF NOT EXISTS housing_addr TEXT,
ADD COLUMN IF NOT EXISTS housing_city TEXT,
ADD COLUMN IF NOT EXISTS housing_state TEXT,
ADD COLUMN IF NOT EXISTS housing_zip TEXT,
ADD COLUMN IF NOT EXISTS housing_capacity INTEGER,
ADD COLUMN IF NOT EXISTS is_meal_provision BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meal_charge NUMERIC,
ADD COLUMN IF NOT EXISTS training_months INTEGER,
ADD COLUMN IF NOT EXISTS job_is_lifting BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS job_lifting_weight TEXT,
ADD COLUMN IF NOT EXISTS job_is_drug_screen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS job_is_background BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS job_is_driver BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shift_start TEXT,
ADD COLUMN IF NOT EXISTS shift_end TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Create indexes for commonly filtered fields
CREATE INDEX IF NOT EXISTS idx_public_jobs_is_active ON public.public_jobs (is_active);
CREATE INDEX IF NOT EXISTS idx_public_jobs_visa_type ON public.public_jobs (visa_type);
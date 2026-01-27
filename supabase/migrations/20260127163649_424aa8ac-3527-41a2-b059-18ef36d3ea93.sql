-- Add advanced AI preferences columns to ai_generation_preferences table
ALTER TABLE public.ai_generation_preferences
ADD COLUMN IF NOT EXISTS emotional_tone text NOT NULL DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS vary_paragraph_order boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_paragraph_count boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS start_with_hook boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_paragraph_length boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS mention_company_naturally boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS reference_sector boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_synonyms boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_job_title_usage boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS avoid_cliches boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS include_ps_line boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_bullet_points boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_number_format boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_cta_position boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vary_email_headers boolean NOT NULL DEFAULT false;
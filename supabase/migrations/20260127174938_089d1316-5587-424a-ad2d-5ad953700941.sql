-- Add opening_style column to ai_generation_preferences
ALTER TABLE public.ai_generation_preferences
ADD COLUMN IF NOT EXISTS opening_style text NOT NULL DEFAULT 'varied';

-- Add comment for documentation
COMMENT ON COLUMN public.ai_generation_preferences.opening_style IS 'Opening style: varied, question, direct_statement, company_mention';
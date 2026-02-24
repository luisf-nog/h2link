
-- Step 1: Add the column
ALTER TABLE public.ai_daily_usage 
ADD COLUMN IF NOT EXISTS resume_conversions integer NOT NULL DEFAULT 0;

-- Step 2: Update the increment function
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id uuid,
  p_function_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_daily_usage (user_id, usage_date, template_generations, resume_parses, job_email_generations, resume_conversions)
  VALUES (
    p_user_id, 
    CURRENT_DATE, 
    CASE WHEN p_function_type = 'template' THEN 1 ELSE 0 END,
    CASE WHEN p_function_type = 'resume' THEN 1 ELSE 0 END,
    CASE WHEN p_function_type = 'job_email' THEN 1 ELSE 0 END,
    CASE WHEN p_function_type = 'resume_conversion' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    template_generations = ai_daily_usage.template_generations + CASE WHEN p_function_type = 'template' THEN 1 ELSE 0 END,
    resume_parses = ai_daily_usage.resume_parses + CASE WHEN p_function_type = 'resume' THEN 1 ELSE 0 END,
    job_email_generations = ai_daily_usage.job_email_generations + CASE WHEN p_function_type = 'job_email' THEN 1 ELSE 0 END,
    resume_conversions = ai_daily_usage.resume_conversions + CASE WHEN p_function_type = 'resume_conversion' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

-- Step 3: Drop old view first, then recreate with new column
DROP VIEW IF EXISTS public.ai_usage_summary;

CREATE VIEW public.ai_usage_summary AS
SELECT 
  usage_date,
  SUM(template_generations) as total_template_generations,
  SUM(resume_parses) as total_resume_parses,
  SUM(job_email_generations) as total_job_email_generations,
  SUM(resume_conversions) as total_resume_conversions,
  COUNT(DISTINCT user_id) as unique_users
FROM public.ai_daily_usage
GROUP BY usage_date
ORDER BY usage_date DESC;

ALTER VIEW public.ai_usage_summary SET (security_invoker = true);

-- Add new columns to ai_daily_usage for tracking all AI functions
ALTER TABLE public.ai_daily_usage 
ADD COLUMN IF NOT EXISTS resume_parses integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS job_email_generations integer NOT NULL DEFAULT 0;

-- Create a summary view for admin dashboard (aggregates all users)
CREATE OR REPLACE VIEW public.ai_usage_summary AS
SELECT 
  usage_date,
  SUM(template_generations) as total_template_generations,
  SUM(resume_parses) as total_resume_parses,
  SUM(job_email_generations) as total_job_email_generations,
  COUNT(DISTINCT user_id) as unique_users
FROM public.ai_daily_usage
GROUP BY usage_date
ORDER BY usage_date DESC;

-- RLS policy for the view - only admins can access
ALTER VIEW public.ai_usage_summary SET (security_invoker = true);

-- Create a function to increment AI usage counters
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
  INSERT INTO ai_daily_usage (user_id, usage_date, template_generations, resume_parses, job_email_generations)
  VALUES (
    p_user_id, 
    CURRENT_DATE, 
    CASE WHEN p_function_type = 'template' THEN 1 ELSE 0 END,
    CASE WHEN p_function_type = 'resume' THEN 1 ELSE 0 END,
    CASE WHEN p_function_type = 'job_email' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    template_generations = ai_daily_usage.template_generations + CASE WHEN p_function_type = 'template' THEN 1 ELSE 0 END,
    resume_parses = ai_daily_usage.resume_parses + CASE WHEN p_function_type = 'resume' THEN 1 ELSE 0 END,
    job_email_generations = ai_daily_usage.job_email_generations + CASE WHEN p_function_type = 'job_email' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

-- Create admin-only policy for viewing all AI usage data
CREATE POLICY "Admins can view all ai usage"
ON public.ai_daily_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
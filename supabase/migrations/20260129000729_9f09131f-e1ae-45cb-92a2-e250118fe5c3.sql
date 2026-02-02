-- Fix the security definer view by dropping and recreating with security_invoker
DROP VIEW IF EXISTS public.job_report_summary;

CREATE VIEW public.job_report_summary 
WITH (security_invoker = on)
AS
SELECT 
  job_id,
  COUNT(*) as report_count,
  array_agg(DISTINCT reason) as reasons
FROM public.job_reports
GROUP BY job_id;
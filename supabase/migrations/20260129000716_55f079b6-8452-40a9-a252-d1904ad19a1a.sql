-- Create job_reports table to track user reports about problematic jobs
CREATE TABLE public.job_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.public_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('invalid_email', 'inactive_job', 'wrong_info', 'spam', 'other')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id) -- One report per user per job
);

-- Add is_banned column to public_jobs to mark banned jobs
ALTER TABLE public.public_jobs ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX idx_job_reports_job_id ON public.job_reports(job_id);
CREATE INDEX idx_public_jobs_is_banned ON public.public_jobs(is_banned) WHERE is_banned = false;

-- Enable RLS
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports for any job (to show warning counts)
CREATE POLICY "Anyone can view job reports"
ON public.job_reports
FOR SELECT
USING (true);

-- Users can insert their own reports
CREATE POLICY "Users can create own reports"
ON public.job_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users cannot update or delete reports
CREATE POLICY "job_reports_deny_update"
ON public.job_reports
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "job_reports_deny_delete"
ON public.job_reports
FOR DELETE
USING (false);

-- Function to auto-ban jobs with 3+ reports
CREATE OR REPLACE FUNCTION public.check_job_ban_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  report_count INTEGER;
BEGIN
  -- Count reports for this job
  SELECT COUNT(*) INTO report_count
  FROM public.job_reports
  WHERE job_id = NEW.job_id;

  -- If 3 or more reports, ban the job
  IF report_count >= 3 THEN
    UPDATE public.public_jobs
    SET is_banned = true
    WHERE id = NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to check ban threshold after each report
CREATE TRIGGER trg_check_job_ban_threshold
AFTER INSERT ON public.job_reports
FOR EACH ROW
EXECUTE FUNCTION public.check_job_ban_threshold();

-- View to get report counts by job (for easy querying)
CREATE OR REPLACE VIEW public.job_report_summary AS
SELECT 
  job_id,
  COUNT(*) as report_count,
  array_agg(DISTINCT reason) as reasons
FROM public.job_reports
GROUP BY job_id;
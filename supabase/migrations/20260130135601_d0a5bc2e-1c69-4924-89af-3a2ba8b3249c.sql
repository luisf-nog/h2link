-- Add scheduled_for column to control when an item can be processed
-- This enables single-item processing without timeouts
ALTER TABLE public.my_queue 
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add column to track if email domain was flagged as invalid
ALTER TABLE public.public_jobs 
ADD COLUMN IF NOT EXISTS email_invalid_dns BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_my_queue_scheduled_pending 
ON public.my_queue (user_id, status, scheduled_for) 
WHERE status = 'pending';

-- Create index for finding jobs with invalid emails
CREATE INDEX IF NOT EXISTS idx_public_jobs_email_invalid 
ON public.public_jobs (email_invalid_dns) 
WHERE email_invalid_dns = true;
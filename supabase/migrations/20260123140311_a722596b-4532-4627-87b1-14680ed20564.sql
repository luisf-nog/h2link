-- Add fields to support background processing and failure tracking
ALTER TABLE public.my_queue
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_my_queue_user_status_created
  ON public.my_queue (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_my_queue_status_created
  ON public.my_queue (status, created_at DESC);
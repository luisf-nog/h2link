-- Add tracking columns to queue_send_history for individual email tracking
ALTER TABLE public.queue_send_history 
ADD COLUMN tracking_id uuid NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN opened_at timestamp with time zone;

-- Create index for faster tracking lookups
CREATE INDEX idx_queue_send_history_tracking_id ON public.queue_send_history(tracking_id);
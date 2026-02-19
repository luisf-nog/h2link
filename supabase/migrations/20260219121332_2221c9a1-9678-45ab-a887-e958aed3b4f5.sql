-- Add open_count column to queue_send_history for counting email opens
ALTER TABLE public.queue_send_history
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0;

-- Add first_opened_at to store the first confirmed open (after 60s delay)
ALTER TABLE public.queue_send_history
  ADD COLUMN IF NOT EXISTS first_opened_at timestamp with time zone;

-- Also add open_count to my_queue for quick display
ALTER TABLE public.my_queue
  ADD COLUMN IF NOT EXISTS email_open_count integer NOT NULL DEFAULT 0;
-- Create table to track send history for each queue item
CREATE TABLE public.queue_send_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES public.my_queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_queue_send_history_queue_id ON public.queue_send_history(queue_id);
CREATE INDEX idx_queue_send_history_user_id ON public.queue_send_history(user_id);

-- Enable RLS
ALTER TABLE public.queue_send_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own send history
CREATE POLICY "Users can view own send history"
ON public.queue_send_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own send history (for frontend manual sends)
CREATE POLICY "Users can insert own send history"
ON public.queue_send_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Deny update and delete
CREATE POLICY "queue_send_history_deny_update"
ON public.queue_send_history
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "queue_send_history_deny_delete"
ON public.queue_send_history
FOR DELETE
USING (false);
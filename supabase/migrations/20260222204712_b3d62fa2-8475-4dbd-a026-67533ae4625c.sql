-- Enable RLS on pixel_open_events
ALTER TABLE public.pixel_open_events ENABLE ROW LEVEL SECURITY;

-- Users can view pixel events for their own queue items (via queue_send_history join)
CREATE POLICY "Users can view own pixel events"
ON public.pixel_open_events
FOR SELECT
USING (
  queue_id IN (
    SELECT id FROM public.my_queue WHERE user_id = auth.uid()
  )
);

-- Deny all writes from anon/authenticated (only service role writes)
CREATE POLICY "pixel_open_events_deny_insert"
ON public.pixel_open_events
FOR INSERT
WITH CHECK (false);

CREATE POLICY "pixel_open_events_deny_update"
ON public.pixel_open_events
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "pixel_open_events_deny_delete"
ON public.pixel_open_events
FOR DELETE
USING (false);

-- Enable RLS on ip_blacklist
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;

-- Deny all access from anon/authenticated (only service role)
CREATE POLICY "ip_blacklist_deny_select"
ON public.ip_blacklist
FOR SELECT
USING (false);

CREATE POLICY "ip_blacklist_deny_insert"
ON public.ip_blacklist
FOR INSERT
WITH CHECK (false);

CREATE POLICY "ip_blacklist_deny_update"
ON public.ip_blacklist
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "ip_blacklist_deny_delete"
ON public.ip_blacklist
FOR DELETE
USING (false);
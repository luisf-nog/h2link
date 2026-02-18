-- Add emails_sent_total column to profiles to track total emails sent per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emails_sent_total integer NOT NULL DEFAULT 0;

-- Create a function to sync emails_sent_total from queue_send_history
CREATE OR REPLACE FUNCTION public.increment_profile_emails_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count successful sends
  IF NEW.status = 'success' THEN
    UPDATE public.profiles
    SET emails_sent_total = emails_sent_total + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on queue_send_history to auto-increment counter
DROP TRIGGER IF EXISTS on_queue_send_history_insert ON public.queue_send_history;
CREATE TRIGGER on_queue_send_history_insert
  AFTER INSERT ON public.queue_send_history
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_profile_emails_sent();

-- Backfill existing data: count successful sends per user
UPDATE public.profiles p
SET emails_sent_total = (
  SELECT COUNT(*) 
  FROM public.queue_send_history qsh
  WHERE qsh.user_id = p.id AND qsh.status = 'success'
);

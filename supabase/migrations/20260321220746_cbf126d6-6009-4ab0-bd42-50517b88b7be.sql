
-- 1. RPC for smart fan-out: only eligible users with pending items
CREATE OR REPLACE FUNCTION public.get_eligible_queue_users()
RETURNS TABLE(user_id uuid) 
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT DISTINCT q.user_id
  FROM my_queue q
  JOIN profiles p ON p.id = q.user_id
  LEFT JOIN smtp_credentials sc ON sc.user_id = q.user_id
  WHERE q.status = 'pending'
  AND (
    p.plan_tier != 'free'
    OR (SELECT COUNT(*) FROM my_queue mq 
        WHERE mq.user_id = q.user_id AND mq.status = 'sent' 
        AND mq.sent_at >= CURRENT_DATE) < 5
  )
  AND (
    p.plan_tier = 'free'
    OR (p.smtp_verified = true AND sc.has_password = true)
  )
  LIMIT 200;
$$;

-- 2. Trigger to prevent free users from exceeding 5 pending+sent per day
CREATE OR REPLACE FUNCTION public.block_free_tier_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER 
SET search_path TO 'public' AS $$
DECLARE
  v_tier plan_tier;
  v_today_total integer;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT plan_tier INTO v_tier FROM profiles WHERE id = NEW.user_id;
    IF v_tier = 'free' THEN
      SELECT COUNT(*) INTO v_today_total FROM my_queue
      WHERE user_id = NEW.user_id
      AND (
        (status = 'pending')
        OR (status = 'sent' AND sent_at >= CURRENT_DATE)
      );
      IF v_today_total >= 5 THEN
        NEW.status := 'blocked_free_tier';
        NEW.last_error := 'Free plan: daily limit exceeded (max 5/day)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_block_free_pending
  BEFORE INSERT ON public.my_queue
  FOR EACH ROW EXECUTE FUNCTION public.block_free_tier_pending();

-- 3. Cleanup: block excess pending items for free users (keep up to 5 minus sent today)
WITH ranked AS (
  SELECT q.id, q.user_id,
    ROW_NUMBER() OVER (PARTITION BY q.user_id ORDER BY q.created_at ASC) as rn,
    (SELECT COUNT(*) FROM my_queue mq 
     WHERE mq.user_id = q.user_id AND mq.status = 'sent' 
     AND mq.sent_at >= CURRENT_DATE) as sent_today
  FROM my_queue q
  JOIN profiles p ON p.id = q.user_id
  WHERE q.status = 'pending' AND p.plan_tier = 'free'
)
UPDATE my_queue SET status = 'blocked_free_tier', 
  last_error = 'Free plan: daily limit exceeded (max 5/day)'
WHERE id IN (SELECT id FROM ranked WHERE rn + sent_today > 5);

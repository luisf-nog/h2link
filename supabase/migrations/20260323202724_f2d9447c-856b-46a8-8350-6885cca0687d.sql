
-- 1. Update RPC to filter out users with consecutive_errors >= 3
CREATE OR REPLACE FUNCTION public.get_eligible_queue_users()
RETURNS TABLE(user_id uuid) 
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT DISTINCT q.user_id
  FROM my_queue q
  JOIN profiles p ON p.id = q.user_id
  LEFT JOIN smtp_credentials sc ON sc.user_id = q.user_id
  WHERE q.status = 'pending'
  AND p.consecutive_errors < 3
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

-- 2. Cleanup: block pending items for users with consecutive_errors >= 3
UPDATE my_queue SET status = 'blocked_free_tier', 
  last_error = 'Consecutive errors exceeded (circuit breaker)'
WHERE status = 'pending' AND user_id IN (
  SELECT id FROM profiles WHERE consecutive_errors >= 3
);

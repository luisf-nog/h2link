-- Sync smtp_credentials.emails_sent_today with actual sent count for today
UPDATE smtp_credentials sc
SET emails_sent_today = sub.cnt
FROM (
  SELECT user_id, COUNT(*) as cnt
  FROM my_queue
  WHERE status = 'sent' AND sent_at::date = CURRENT_DATE
  GROUP BY user_id
) sub
WHERE sc.user_id = sub.user_id
  AND sc.last_usage_date = CURRENT_DATE;
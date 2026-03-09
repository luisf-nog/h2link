-- Reset items stuck in 'processing' back to 'pending'
UPDATE public.my_queue 
SET status = 'pending', last_error = NULL, processing_started_at = NULL
WHERE status = 'processing' 
AND processing_started_at < NOW() - INTERVAL '10 minutes';

-- Reset items paused by the removed circuit breaker back to 'pending'
UPDATE public.my_queue 
SET status = 'pending', last_error = NULL
WHERE status = 'paused' 
AND last_error LIKE '%CIRCUIT_BREAKER%';

-- Also reset items paused by the old "3 erros consecutivos" pattern
UPDATE public.my_queue 
SET status = 'pending', last_error = NULL
WHERE status = 'paused' 
AND last_error LIKE '%erros consecutivos%';
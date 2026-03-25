-- 1. Remove realtime from my_queue (major DB load source)
ALTER PUBLICATION supabase_realtime DROP TABLE public.my_queue;

-- 2. Force cron to 10 minutes
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-queue-every-minute'),
  '*/10 * * * *'
);
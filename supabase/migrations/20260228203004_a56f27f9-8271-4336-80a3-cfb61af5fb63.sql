-- Re-schedule auto-import cron jobs to use x-cron-token header (dynamic from app_settings)
-- This fixes authentication: the old commands sent a static anon Bearer token which was rejected.

SELECT cron.unschedule('auto-import-jo');
SELECT cron.unschedule('auto-import-h2a');
SELECT cron.unschedule('auto-import-h2b');

SELECT cron.schedule(
  'auto-import-jo',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dalarhopratsgzmmzhxx.supabase.co/functions/v1/auto-import-jobs',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-token',(SELECT cron_token::text FROM public.app_settings WHERE id = 1)
    ),
    body := '{"source":"jo"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'auto-import-h2a',
  '5 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dalarhopratsgzmmzhxx.supabase.co/functions/v1/auto-import-jobs',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-token',(SELECT cron_token::text FROM public.app_settings WHERE id = 1)
    ),
    body := '{"source":"h2a"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'auto-import-h2b',
  '10 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dalarhopratsgzmmzhxx.supabase.co/functions/v1/auto-import-jobs',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-token',(SELECT cron_token::text FROM public.app_settings WHERE id = 1)
    ),
    body := '{"source":"h2b"}'::jsonb
  ) AS request_id;
  $$
);
-- Move pg_cron/pg_net out of public by recreating them in a dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate extensions in extensions schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE 'DROP EXTENSION pg_net';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'DROP EXTENSION pg_cron';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
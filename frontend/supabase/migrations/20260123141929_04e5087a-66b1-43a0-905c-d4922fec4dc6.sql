-- Reputation Shield: timezone + circuit breaker counters on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS consecutive_errors integer NOT NULL DEFAULT 0;
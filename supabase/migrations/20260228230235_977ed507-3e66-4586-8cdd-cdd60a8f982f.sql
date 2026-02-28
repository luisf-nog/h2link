
-- Add resumable job fields to import_jobs
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS cursor_pos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- Index for finding active jobs efficiently
CREATE INDEX IF NOT EXISTS idx_import_jobs_status_source ON public.import_jobs (status, source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_phase_heartbeat ON public.import_jobs (phase, last_heartbeat_at);

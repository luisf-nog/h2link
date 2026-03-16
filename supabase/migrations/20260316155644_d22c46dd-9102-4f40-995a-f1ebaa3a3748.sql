
-- 1. Index on profiles(id) already exists as PK, but the seq scans come from 
--    the process-queue fan-out querying profiles with .in("plan_tier", [...])
CREATE INDEX IF NOT EXISTS idx_profiles_plan_tier ON public.profiles (plan_tier);

-- 2. Index on email_templates for user_id lookups (eliminates 20K seq scans)
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON public.email_templates (user_id);

-- 3. Index on my_queue for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_my_queue_user_status_created ON public.my_queue (user_id, status, created_at);

-- 4. Index on my_queue for sent_at dedup queries
CREATE INDEX IF NOT EXISTS idx_my_queue_user_status_sent ON public.my_queue (user_id, status, sent_at) WHERE status = 'sent';

-- 5. Index on radar_matched_jobs for the chunked lookups
CREATE INDEX IF NOT EXISTS idx_radar_matched_user_job ON public.radar_matched_jobs (user_id, job_id);

-- 6. Index on public_jobs for radar queries (active + not banned + posted_date)
CREATE INDEX IF NOT EXISTS idx_public_jobs_active_posted ON public.public_jobs (is_active, is_banned, posted_date DESC) WHERE is_active = true AND is_banned = false;

-- 7. Index on smtp_credentials for user_id lookups
CREATE INDEX IF NOT EXISTS idx_smtp_credentials_user_id ON public.smtp_credentials (user_id);

-- 8. Index on smtp_credentials_secrets for user_id lookups
CREATE INDEX IF NOT EXISTS idx_smtp_secrets_user_id ON public.smtp_credentials_secrets (user_id);

-- 1) Extend profiles with onboarding fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 2) Track daily AI generations per user (enforced in backend)
CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  template_generations INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage (optional UI); no INSERT/UPDATE policies for clients.
DROP POLICY IF EXISTS "Users can view own ai usage" ON public.ai_daily_usage;
CREATE POLICY "Users can view own ai usage"
ON public.ai_daily_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Keep updated_at fresh when backend updates the row
DROP TRIGGER IF EXISTS update_ai_daily_usage_updated_at ON public.ai_daily_usage;
CREATE TRIGGER update_ai_daily_usage_updated_at
BEFORE UPDATE ON public.ai_daily_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SMART EMAIL WARM-UP SYSTEM
-- =============================================

-- 1. Create ENUM for risk_profile
CREATE TYPE public.email_risk_profile AS ENUM ('conservative', 'standard', 'aggressive');

-- 2. Add new columns to smtp_credentials table
ALTER TABLE public.smtp_credentials
ADD COLUMN IF NOT EXISTS risk_profile public.email_risk_profile DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_daily_limit integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS emails_sent_today integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_usage_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS warmup_started_at date DEFAULT NULL;

-- 3. Create function to calculate warm-up limits
CREATE OR REPLACE FUNCTION public.calculate_warmup_limit(
  p_risk_profile public.email_risk_profile,
  p_current_limit integer,
  p_emails_sent integer,
  p_plan_tier public.plan_tier
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  start_limit integer;
  multiplier numeric;
  plan_max integer;
  new_limit integer;
  progress_threshold numeric := 0.8;
BEGIN
  -- Plan max limits (hard caps)
  CASE p_plan_tier
    WHEN 'free' THEN plan_max := 5;
    WHEN 'gold' THEN plan_max := 150;
    WHEN 'diamond' THEN plan_max := 350;
    WHEN 'black' THEN plan_max := 450;
    ELSE plan_max := 5;
  END CASE;

  -- Free tier has no warm-up
  IF p_plan_tier = 'free' THEN
    RETURN 5;
  END IF;

  -- If no profile set yet, return starting limit for conservative
  IF p_risk_profile IS NULL THEN
    RETURN 20;
  END IF;

  -- Warm-up parameters by risk profile
  CASE p_risk_profile
    WHEN 'conservative' THEN
      start_limit := 20;
      multiplier := 1.3;
    WHEN 'standard' THEN
      start_limit := 50;
      multiplier := 1.5;
    WHEN 'aggressive' THEN
      start_limit := 100;
      multiplier := 2.0;
    ELSE
      start_limit := 20;
      multiplier := 1.3;
  END CASE;

  -- If no current limit set, return start limit
  IF p_current_limit IS NULL OR p_current_limit < start_limit THEN
    RETURN LEAST(start_limit, plan_max);
  END IF;

  -- Check 80% rule: did user send at least 80% of yesterday's limit?
  IF p_emails_sent >= (p_current_limit * progress_threshold) THEN
    new_limit := CEIL(p_current_limit * multiplier);
  ELSE
    new_limit := p_current_limit; -- No increase
  END IF;

  -- Cap at plan maximum
  RETURN LEAST(new_limit, plan_max);
END;
$$;

-- 4. Create function to get effective daily limit (respects warm-up)
CREATE OR REPLACE FUNCTION public.get_effective_daily_limit(
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_tier public.plan_tier;
  v_referral_bonus integer;
  v_risk_profile public.email_risk_profile;
  v_current_limit integer;
  v_plan_max integer;
  v_effective integer;
BEGIN
  -- Get profile info
  SELECT plan_tier, COALESCE(referral_bonus_limit, 0)
  INTO v_plan_tier, v_referral_bonus
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_plan_tier IS NULL THEN
    RETURN 5;
  END IF;

  -- Free tier always gets fixed limit
  IF v_plan_tier = 'free' THEN
    RETURN 5 + v_referral_bonus;
  END IF;

  -- Get SMTP warm-up state
  SELECT risk_profile, current_daily_limit
  INTO v_risk_profile, v_current_limit
  FROM public.smtp_credentials
  WHERE user_id = p_user_id;

  -- Plan max limits
  CASE v_plan_tier
    WHEN 'gold' THEN v_plan_max := 150;
    WHEN 'diamond' THEN v_plan_max := 350;
    WHEN 'black' THEN v_plan_max := 450;
    ELSE v_plan_max := 5;
  END CASE;

  -- If no SMTP or no risk profile, return starting conservative limit
  IF v_risk_profile IS NULL THEN
    v_effective := 20;
  ELSIF v_current_limit IS NULL THEN
    -- First day with profile set
    CASE v_risk_profile
      WHEN 'conservative' THEN v_effective := 20;
      WHEN 'standard' THEN v_effective := 50;
      WHEN 'aggressive' THEN v_effective := 100;
      ELSE v_effective := 20;
    END CASE;
  ELSE
    v_effective := v_current_limit;
  END IF;

  -- Cap at plan max + referral bonus
  RETURN LEAST(v_effective, v_plan_max) + v_referral_bonus;
END;
$$;

-- 5. Create function to update daily limits (called at start of day or before sending)
CREATE OR REPLACE FUNCTION public.update_smtp_warmup_limit(
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_tier public.plan_tier;
  v_risk_profile public.email_risk_profile;
  v_current_limit integer;
  v_emails_sent integer;
  v_last_date date;
  v_today date := CURRENT_DATE;
  v_new_limit integer;
BEGIN
  -- Get profile
  SELECT plan_tier INTO v_plan_tier
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_plan_tier IS NULL OR v_plan_tier = 'free' THEN
    RETURN 5;
  END IF;

  -- Get SMTP state
  SELECT risk_profile, current_daily_limit, emails_sent_today, last_usage_date
  INTO v_risk_profile, v_current_limit, v_emails_sent, v_last_date
  FROM public.smtp_credentials
  WHERE user_id = p_user_id;

  -- No SMTP credentials
  IF v_risk_profile IS NULL THEN
    RETURN 20;
  END IF;

  -- If it's a new day, calculate progression
  IF v_last_date IS NULL OR v_last_date < v_today THEN
    -- Calculate new limit based on yesterday's performance
    v_new_limit := public.calculate_warmup_limit(
      v_risk_profile,
      v_current_limit,
      v_emails_sent,
      v_plan_tier
    );

    -- Update SMTP credentials for new day
    UPDATE public.smtp_credentials
    SET current_daily_limit = v_new_limit,
        emails_sent_today = 0,
        last_usage_date = v_today
    WHERE user_id = p_user_id;

    RETURN v_new_limit;
  ELSE
    -- Same day, return current limit
    RETURN COALESCE(v_current_limit, 20);
  END IF;
END;
$$;

-- 6. Create function to downgrade on critical errors
CREATE OR REPLACE FUNCTION public.downgrade_smtp_warmup(
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.smtp_credentials
  SET risk_profile = 'conservative',
      current_daily_limit = 20,
      warmup_started_at = CURRENT_DATE
  WHERE user_id = p_user_id;
END;
$$;

-- 7. Create function to increment daily email count
CREATE OR REPLACE FUNCTION public.increment_smtp_email_count(
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.smtp_credentials
  SET emails_sent_today = emails_sent_today + 1,
      last_usage_date = CURRENT_DATE
  WHERE user_id = p_user_id;
END;
$$;
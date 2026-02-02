-- Referral System V2 (activation-based) using public.profiles + referral_links

-- 1) Add referral columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS is_referral_activated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_bonus_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_referrals_count integer NOT NULL DEFAULT 0;

-- FK to profiles (NOT auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referred_by_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referred_by_fkey
      FOREIGN KEY (referred_by) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- unique referral_code (allow nulls)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uq ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

-- 2) Table to let referrers see their referred users without opening profiles RLS
CREATE TABLE IF NOT EXISTS public.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  activated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

-- Policies (no IF NOT EXISTS in Postgres)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='Referrers can view their referral links') THEN
    EXECUTE 'CREATE POLICY "Referrers can view their referral links" ON public.referral_links FOR SELECT USING (auth.uid() = referrer_id)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='Referred users can view their own referral link') THEN
    EXECUTE 'CREATE POLICY "Referred users can view their own referral link" ON public.referral_links FOR SELECT USING (auth.uid() = referred_id)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='referral_links_deny_insert') THEN
    EXECUTE 'CREATE POLICY "referral_links_deny_insert" ON public.referral_links FOR INSERT WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='referral_links_deny_update') THEN
    EXECUTE 'CREATE POLICY "referral_links_deny_update" ON public.referral_links FOR UPDATE USING (false) WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='referral_links_deny_delete') THEN
    EXECUTE 'CREATE POLICY "referral_links_deny_delete" ON public.referral_links FOR DELETE USING (false)';
  END IF;
END$$;

-- 3) Generate referral code (6 chars) + ensure uniqueness
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.referral_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- 4) Before insert: set referral_code if missing
CREATE OR REPLACE FUNCTION public.set_profiles_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR trim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_referral_code();
  ELSE
    NEW.referral_code := upper(trim(NEW.referral_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profiles_referral_code();

-- 5) Ensure link row exists when referred_by is set (insert or update)
CREATE OR REPLACE FUNCTION public.ensure_referral_link_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    INSERT INTO public.referral_links (referrer_id, referred_id)
    VALUES (NEW.referred_by, NEW.id)
    ON CONFLICT (referrer_id, referred_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_link_ins ON public.profiles;
CREATE TRIGGER trg_profiles_referral_link_ins
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_referral_link_row();

DROP TRIGGER IF EXISTS trg_profiles_referral_link_upd ON public.profiles;
CREATE TRIGGER trg_profiles_referral_link_upd
AFTER UPDATE OF referred_by ON public.profiles
FOR EACH ROW
WHEN (NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION public.ensure_referral_link_row();

-- 6) Activation trigger: when a queue item becomes sent
CREATE OR REPLACE FUNCTION public.check_first_email_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child public.profiles%ROWTYPE;
  parent public.profiles%ROWTYPE;
  parent_id uuid;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (COALESCE(OLD.status,'') <> 'sent') AND (NEW.status = 'sent') THEN
      SELECT * INTO child FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

      IF child.id IS NULL THEN
        RETURN NEW;
      END IF;

      parent_id := child.referred_by;

      IF parent_id IS NULL OR child.is_referral_activated = true THEN
        RETURN NEW;
      END IF;

      UPDATE public.profiles
        SET is_referral_activated = true,
            referral_bonus_limit = referral_bonus_limit + 5
      WHERE id = child.id;

      UPDATE public.referral_links
        SET activated_at = now()
      WHERE referrer_id = parent_id AND referred_id = child.id AND activated_at IS NULL;

      SELECT * INTO parent FROM public.profiles WHERE id = parent_id FOR UPDATE;
      IF parent.id IS NULL THEN
        RETURN NEW;
      END IF;

      IF COALESCE(parent.active_referrals_count,0) < 10 THEN
        UPDATE public.profiles
          SET active_referrals_count = active_referrals_count + 1,
              referral_bonus_limit = referral_bonus_limit + 5
        WHERE id = parent.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_my_queue_referral_activation ON public.my_queue;
CREATE TRIGGER trg_my_queue_referral_activation
AFTER UPDATE OF status ON public.my_queue
FOR EACH ROW
EXECUTE FUNCTION public.check_first_email_activation();

-- Add explicit "deny all" RLS policies for app_settings (service role bypasses RLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='app_settings_deny_select') THEN
    EXECUTE 'CREATE POLICY app_settings_deny_select ON public.app_settings FOR SELECT USING (false)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='app_settings_deny_insert') THEN
    EXECUTE 'CREATE POLICY app_settings_deny_insert ON public.app_settings FOR INSERT WITH CHECK (false)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='app_settings_deny_update') THEN
    EXECUTE 'CREATE POLICY app_settings_deny_update ON public.app_settings FOR UPDATE USING (false) WITH CHECK (false)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='app_settings_deny_delete') THEN
    EXECUTE 'CREATE POLICY app_settings_deny_delete ON public.app_settings FOR DELETE USING (false)';
  END IF;
END $$;
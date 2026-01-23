-- Email templates (per-user)
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful index + per-user name uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_user_name_uq
  ON public.email_templates (user_id, name);

CREATE INDEX IF NOT EXISTS email_templates_user_created_idx
  ON public.email_templates (user_id, created_at DESC);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own templates"
ON public.email_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
ON public.email_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
ON public.email_templates
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
ON public.email_templates
FOR DELETE
USING (auth.uid() = user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

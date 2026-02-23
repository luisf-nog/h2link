
-- Table to store sector-optimized resumes (Black tier: up to 5)
-- Gold gets 1, Diamond gets 2, Black gets 5
CREATE TABLE public.sector_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,           -- matches public_jobs.category
  visa_type TEXT NOT NULL DEFAULT 'H-2B', -- H-2A, H-2B, or both
  resume_data JSONB NOT NULL,       -- the generated resume JSON
  resume_url TEXT,                  -- stored PDF URL if any
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category)         -- one resume per category per user
);

-- Enable RLS
ALTER TABLE public.sector_resumes ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own sector resumes
CREATE POLICY "Users can view own sector resumes"
  ON public.sector_resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sector resumes"
  ON public.sector_resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sector resumes"
  ON public.sector_resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sector resumes"
  ON public.sector_resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_sector_resumes_updated_at
  BEFORE UPDATE ON public.sector_resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

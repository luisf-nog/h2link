
-- Create radar_profiles table for automated job matching
CREATE TABLE public.radar_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  auto_send BOOLEAN NOT NULL DEFAULT false,
  categories TEXT[] DEFAULT '{}',
  min_wage NUMERIC DEFAULT NULL,
  visa_type TEXT DEFAULT NULL,
  state TEXT DEFAULT NULL,
  last_scan_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.radar_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own radar profile"
ON public.radar_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own radar profile"
ON public.radar_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own radar profile"
ON public.radar_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own radar profile"
ON public.radar_profiles FOR DELETE
USING (auth.uid() = user_id);

-- Track which jobs the radar already processed (to avoid duplicates)
CREATE TABLE public.radar_matched_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.public_jobs(id) ON DELETE CASCADE,
  matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  auto_queued BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, job_id)
);

-- Enable RLS
ALTER TABLE public.radar_matched_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own radar matches"
ON public.radar_matched_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert radar matches"
ON public.radar_matched_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for fast scanning
CREATE INDEX idx_radar_profiles_active ON public.radar_profiles (is_active) WHERE is_active = true;
CREATE INDEX idx_radar_matched_jobs_user ON public.radar_matched_jobs (user_id, job_id);

-- Trigger for updated_at
CREATE TRIGGER update_radar_profiles_updated_at
BEFORE UPDATE ON public.radar_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload their own resume
CREATE POLICY "Users can upload own resume"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Users can update their own resume
CREATE POLICY "Users can update own resume"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Users can delete their own resume
CREATE POLICY "Users can delete own resume"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Resumes are publicly readable (needed for email attachment fetch)
CREATE POLICY "Resumes are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'resumes');

-- Add resume_url column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS resume_url text;
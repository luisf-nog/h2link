-- Add lines_per_paragraph column to ai_generation_preferences
ALTER TABLE public.ai_generation_preferences 
ADD COLUMN IF NOT EXISTS lines_per_paragraph integer NOT NULL DEFAULT 3;
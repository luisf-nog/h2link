-- Create user AI preferences for Black tier customization
CREATE TABLE public.ai_generation_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email structure preferences
  paragraph_style TEXT NOT NULL DEFAULT 'multiple' CHECK (paragraph_style IN ('single', 'multiple')),
  email_length TEXT NOT NULL DEFAULT 'medium' CHECK (email_length IN ('short', 'medium', 'long')),
  
  -- Tone and formality  
  formality_level TEXT NOT NULL DEFAULT 'professional' CHECK (formality_level IN ('casual', 'professional', 'formal')),
  
  -- Greeting customization (avoid repetitive "Dear Hiring Manager")
  greeting_style TEXT NOT NULL DEFAULT 'varied' CHECK (greeting_style IN ('hello', 'dear_manager', 'dear_team', 'varied')),
  
  -- Closing customization
  closing_style TEXT NOT NULL DEFAULT 'best_regards' CHECK (closing_style IN ('best_regards', 'sincerely', 'thank_you', 'varied')),
  
  -- Emphasis preferences
  emphasize_availability BOOLEAN NOT NULL DEFAULT true,
  emphasize_physical_strength BOOLEAN NOT NULL DEFAULT true,
  emphasize_languages BOOLEAN NOT NULL DEFAULT true,
  
  -- Custom instructions (user can add personal notes)
  custom_instructions TEXT DEFAULT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_generation_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own ai preferences"
ON public.ai_generation_preferences FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own ai preferences"
ON public.ai_generation_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own ai preferences"
ON public.ai_generation_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ai_generation_preferences_updated_at
BEFORE UPDATE ON public.ai_generation_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS smtp_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_smtp_check timestamptz;

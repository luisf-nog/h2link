-- Add send_count column to track how many times an email was sent to the same recipient
ALTER TABLE public.my_queue ADD COLUMN send_count integer NOT NULL DEFAULT 1;
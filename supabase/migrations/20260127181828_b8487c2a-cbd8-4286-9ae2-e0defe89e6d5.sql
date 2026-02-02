-- Fix send_count default: should start at 0 (not 1) and be incremented after each send
ALTER TABLE public.my_queue ALTER COLUMN send_count SET DEFAULT 0;

-- Update existing rows that have send_count = 1 but were never sent (status = 'pending')
UPDATE public.my_queue SET send_count = 0 WHERE status = 'pending' AND send_count = 1;
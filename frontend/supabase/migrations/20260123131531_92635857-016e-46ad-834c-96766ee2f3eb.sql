-- Allow queue rows to reference manual_job_id by making job_id nullable
ALTER TABLE public.my_queue
ALTER COLUMN job_id DROP NOT NULL;
-- Add new columns to public_jobs table for extended job information
ALTER TABLE public.public_jobs 
ADD COLUMN IF NOT EXISTS job_duties TEXT,
ADD COLUMN IF NOT EXISTS job_min_special_req TEXT,
ADD COLUMN IF NOT EXISTS wage_additional TEXT,
ADD COLUMN IF NOT EXISTS rec_pay_deductions TEXT;
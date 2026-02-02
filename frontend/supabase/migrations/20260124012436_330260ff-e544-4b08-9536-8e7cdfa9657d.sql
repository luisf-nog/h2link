-- 1) Add open-tracking fields to my_queue (used as sent email history)
ALTER TABLE public.my_queue
  ADD COLUMN IF NOT EXISTS tracking_id uuid;

ALTER TABLE public.my_queue
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- Set default for new rows
ALTER TABLE public.my_queue
  ALTER COLUMN tracking_id SET DEFAULT gen_random_uuid();

-- Backfill existing rows
UPDATE public.my_queue
SET tracking_id = gen_random_uuid()
WHERE tracking_id IS NULL;

-- Enforce not-null and uniqueness (safe after backfill)
ALTER TABLE public.my_queue
  ALTER COLUMN tracking_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'my_queue_tracking_id_unique'
  ) THEN
    ALTER TABLE public.my_queue
      ADD CONSTRAINT my_queue_tracking_id_unique UNIQUE (tracking_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_my_queue_opened_at ON public.my_queue (opened_at);
CREATE INDEX IF NOT EXISTS idx_my_queue_tracking_id ON public.my_queue (tracking_id);

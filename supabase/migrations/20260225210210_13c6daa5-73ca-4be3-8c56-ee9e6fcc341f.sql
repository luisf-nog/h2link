
ALTER TABLE public.my_queue
ADD COLUMN cached_subject text,
ADD COLUMN cached_body text;

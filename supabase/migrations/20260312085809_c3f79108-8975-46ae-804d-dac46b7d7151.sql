ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS village text DEFAULT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS post_office text DEFAULT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS district text DEFAULT NULL;
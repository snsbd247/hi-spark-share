ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS subnet text,
  ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS connectivity_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pop_location text,
  ADD COLUMN IF NOT EXISTS installed_by text,
  ADD COLUMN IF NOT EXISTS box_name text,
  ADD COLUMN IF NOT EXISTS cable_length text,
  ADD COLUMN IF NOT EXISTS permanent_address text;
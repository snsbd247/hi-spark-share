
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS setup_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS setup_geo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_accounts boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_templates boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_ledger boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_setup boolean DEFAULT false;

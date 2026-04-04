
-- Add default_commission column to resellers table
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS default_commission numeric(10,2) DEFAULT NULL;

-- Create reseller_package_commissions table
CREATE TABLE IF NOT EXISTS public.reseller_package_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reseller_id, package_id)
);

-- Add commission tracking fields to bills table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS base_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS commission_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS reseller_profit numeric(10,2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS tenant_amount numeric(10,2) DEFAULT 0;

-- Enable RLS on new table
ALTER TABLE public.reseller_package_commissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for reseller_package_commissions
CREATE POLICY "Allow anon full access to reseller_package_commissions" ON public.reseller_package_commissions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_reseller_pkg_comm_reseller ON public.reseller_package_commissions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_pkg_comm_package ON public.reseller_package_commissions(package_id);
CREATE INDEX IF NOT EXISTS idx_bills_reseller_id ON public.bills(reseller_id);

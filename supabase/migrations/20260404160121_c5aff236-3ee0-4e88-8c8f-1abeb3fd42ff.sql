
-- Commission ledger table to track monthly auto-calculated commissions
CREATE TABLE public.reseller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  month TEXT NOT NULL,
  total_billing NUMERIC(12,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  commission_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reseller_id, month)
);

ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;

-- Anon can read/write (custom auth uses anon role)
CREATE POLICY "anon_select_reseller_commissions" ON public.reseller_commissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_reseller_commissions" ON public.reseller_commissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_reseller_commissions" ON public.reseller_commissions FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- RESELLER MODULE - Database Tables
-- ═══════════════════════════════════════════════════════

-- 1. Resellers table
CREATE TABLE public.resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  password_hash TEXT,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Reseller wallet transactions
CREATE TABLE public.reseller_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Reseller sessions for separate login
CREATE TABLE public.reseller_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  browser TEXT,
  device_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add reseller_id to customers (nullable - direct customers have NULL)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX idx_resellers_tenant ON public.resellers(tenant_id);
CREATE INDEX idx_resellers_status ON public.resellers(tenant_id, status);
CREATE INDEX idx_reseller_wallet_reseller ON public.reseller_wallet_transactions(reseller_id);
CREATE INDEX idx_reseller_sessions_token ON public.reseller_sessions(session_token);
CREATE INDEX idx_customers_reseller ON public.customers(reseller_id) WHERE reseller_id IS NOT NULL;

-- 6. RLS
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_sessions ENABLE ROW LEVEL SECURITY;

-- Anon policies (tenant admins use custom auth = anon role)
CREATE POLICY "Anon can manage resellers" ON public.resellers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage reseller_wallet_transactions" ON public.reseller_wallet_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage reseller_sessions" ON public.reseller_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
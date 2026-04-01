
-- ── SaaS Plans ──
CREATE TABLE IF NOT EXISTS public.saas_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  price_monthly numeric(10,2) DEFAULT 0,
  price_yearly numeric(10,2) DEFAULT 0,
  max_customers integer DEFAULT 100,
  max_users integer DEFAULT 5,
  max_routers integer DEFAULT 2,
  has_accounting boolean DEFAULT false,
  has_hr boolean DEFAULT false,
  has_inventory boolean DEFAULT false,
  has_sms boolean DEFAULT true,
  has_custom_domain boolean DEFAULT false,
  features jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.saas_plans FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.saas_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Tenants ──
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE,
  email text,
  phone text,
  logo_url text,
  status text DEFAULT 'active',
  plan text DEFAULT 'basic',
  trial_ends_at timestamptz,
  settings jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.tenants FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Subscriptions ──
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE RESTRICT,
  billing_cycle text DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active',
  amount numeric(10,2) DEFAULT 0,
  payment_method text,
  transaction_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.subscriptions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Domains ──
CREATE TABLE IF NOT EXISTS public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain text UNIQUE NOT NULL,
  is_primary boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.domains FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.domains FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add tenant_id to sms_wallets if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_wallets' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.sms_wallets ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

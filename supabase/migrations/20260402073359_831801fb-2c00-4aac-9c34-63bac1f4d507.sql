
-- In-app notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  link text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.notifications FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_tenant ON public.notifications(tenant_id);

-- Coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'fixed',
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.coupons FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.coupons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- IP Pool management
CREATE TABLE IF NOT EXISTS public.ip_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subnet text NOT NULL,
  gateway text,
  start_ip text NOT NULL,
  end_ip text NOT NULL,
  router_id uuid REFERENCES public.mikrotik_routers(id) ON DELETE SET NULL,
  total_ips integer NOT NULL DEFAULT 0,
  used_ips integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ip_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.ip_pools FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.ip_pools FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FAQ module
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'general',
  sort_order integer DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.faqs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.faqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ticket admin notes
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- Partial payment support on bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;

-- Tenant limits
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_users integer DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_customers integer DEFAULT 0;

-- Customer MAC binding
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS mac_address text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS static_ip text;

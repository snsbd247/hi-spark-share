
-- Online sessions table for MikroTik active user tracking
CREATE TABLE IF NOT EXISTS public.online_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  pppoe_username text NOT NULL,
  ip_address text,
  mac_address text,
  uptime text,
  router_id uuid REFERENCES public.mikrotik_routers(id) ON DELETE SET NULL,
  bytes_in bigint DEFAULT 0,
  bytes_out bigint DEFAULT 0,
  connected_at timestamp with time zone DEFAULT now(),
  last_seen timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'online',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.online_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_access" ON public.online_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.online_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Overdue fines config table
CREATE TABLE IF NOT EXISTS public.billing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_access" ON public.billing_config FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.billing_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default billing config
INSERT INTO public.billing_config (config_key, config_value, description) VALUES
  ('overdue_fine_amount', '50', 'Late payment fine in BDT'),
  ('overdue_grace_days', '7', 'Days after due date before fine applies'),
  ('auto_suspend_days', '15', 'Days after due date to auto-suspend customer'),
  ('bill_generation_day', '1', 'Day of month to generate bills');

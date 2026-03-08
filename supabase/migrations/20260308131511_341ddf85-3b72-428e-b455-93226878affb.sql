
-- General Settings table
CREATE TABLE public.general_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'Smart ISP',
  address text,
  email text,
  mobile text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.general_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage general settings" ON public.general_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can read general settings" ON public.general_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Insert default row
INSERT INTO public.general_settings (site_name) VALUES ('Smart ISP');

-- Zones table
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_name text NOT NULL,
  address text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage zones" ON public.zones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view zones" ON public.zones
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anyone can read zones" ON public.zones
  FOR SELECT TO anon, authenticated
  USING (true);

-- MikroTik Routers table
CREATE TABLE public.mikrotik_routers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ip_address text NOT NULL,
  username text NOT NULL DEFAULT 'admin',
  password text NOT NULL,
  api_port integer NOT NULL DEFAULT 8728,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mikrotik_routers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mikrotik routers" ON public.mikrotik_routers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view mikrotik routers" ON public.mikrotik_routers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

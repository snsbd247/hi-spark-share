
-- OLT table
CREATE TABLE public.olts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  location TEXT,
  brand TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.olts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view OLTs" ON public.olts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can manage OLTs" ON public.olts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ONU table
CREATE TABLE public.onus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL UNIQUE,
  mac_address TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  olt_id UUID REFERENCES public.olts(id) ON DELETE SET NULL,
  olt_port TEXT,
  signal_strength TEXT,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'faulty', 'unregistered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ONUs" ON public.onus
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can manage ONUs" ON public.onus
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Add bandwidth fields to packages
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS download_speed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS upload_speed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS burst_limit TEXT;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS mikrotik_profile_name TEXT;

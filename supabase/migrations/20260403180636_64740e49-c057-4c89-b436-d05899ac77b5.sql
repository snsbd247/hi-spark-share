
-- Add GPS coordinates to fiber_olts
ALTER TABLE public.fiber_olts ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.fiber_olts ADD COLUMN IF NOT EXISTS lng double precision;

-- Add connected_olt_port_id to fiber_cores
ALTER TABLE public.fiber_cores ADD COLUMN IF NOT EXISTS connected_olt_port_id uuid REFERENCES public.fiber_pon_ports(id) ON DELETE SET NULL;

-- Add GPS coordinates to fiber_splitters
ALTER TABLE public.fiber_splitters ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.fiber_splitters ADD COLUMN IF NOT EXISTS lng double precision;

-- Add color, connection_type, connected_id to fiber_splitter_outputs
ALTER TABLE public.fiber_splitter_outputs ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.fiber_splitter_outputs ADD COLUMN IF NOT EXISTS connection_type text DEFAULT 'onu';
ALTER TABLE public.fiber_splitter_outputs ADD COLUMN IF NOT EXISTS connected_id uuid;

-- Create core_connections table for splice tracking
CREATE TABLE IF NOT EXISTS public.core_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_core_id uuid NOT NULL REFERENCES public.fiber_cores(id) ON DELETE CASCADE,
  to_core_id uuid NOT NULL REFERENCES public.fiber_cores(id) ON DELETE CASCADE,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(from_core_id, to_core_id)
);

CREATE INDEX IF NOT EXISTS idx_core_connections_tenant ON public.core_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fiber_cores_connected_port ON public.fiber_cores(connected_olt_port_id);

-- RLS for core_connections
ALTER TABLE public.core_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for core_connections" ON public.core_connections
  FOR ALL USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());


-- Create tenant_company_info table for tenant-specific branding (invoices, PDFs, reports)
CREATE TABLE IF NOT EXISTS public.tenant_company_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_company_info ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view tenant_company_info"
  ON public.tenant_company_info FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tenant_company_info"
  ON public.tenant_company_info FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tenant_company_info"
  ON public.tenant_company_info FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Migrate existing data from general_settings to tenant_company_info
INSERT INTO public.tenant_company_info (tenant_id, company_name, address, phone, email, logo_url)
SELECT gs.tenant_id, gs.site_name, COALESCE(gs.address, ''), COALESCE(gs.mobile, ''), COALESCE(gs.email, ''), COALESCE(gs.logo_url, '')
FROM public.general_settings gs
WHERE gs.tenant_id IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

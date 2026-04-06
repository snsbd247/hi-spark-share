-- 1. Enable RLS on landing_sections
ALTER TABLE public.landing_sections ENABLE ROW LEVEL SECURITY;

-- Allow public read access for landing page content
CREATE POLICY "landing_sections_public_read" ON public.landing_sections
  FOR SELECT USING (true);

-- Allow authenticated users to manage landing sections
CREATE POLICY "landing_sections_auth_manage" ON public.landing_sections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Fix resellers_public view - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.resellers_public;

CREATE VIEW public.resellers_public
WITH (security_invoker = true)
AS
SELECT id, tenant_id, user_id, name, company_name, phone, email, address,
       commission_rate, wallet_balance, status, created_at, updated_at
FROM public.resellers;
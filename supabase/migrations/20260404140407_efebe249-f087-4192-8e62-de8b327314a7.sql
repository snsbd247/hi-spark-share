CREATE POLICY "Anon users can view tenant_company_info"
  ON public.tenant_company_info FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert tenant_company_info"
  ON public.tenant_company_info FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon users can update tenant_company_info"
  ON public.tenant_company_info FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TABLE public.customer_reseller_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  old_reseller_id UUID REFERENCES public.resellers(id),
  new_reseller_id UUID REFERENCES public.resellers(id),
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_tenant ON public.customer_reseller_migrations(tenant_id);
CREATE INDEX idx_crm_customer ON public.customer_reseller_migrations(customer_id);

ALTER TABLE public.customer_reseller_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view migration logs"
  ON public.customer_reseller_migrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Tenant users can insert migration logs"
  ON public.customer_reseller_migrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

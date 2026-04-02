-- Add tenant_id to payment_gateways for multi-tenant isolation
ALTER TABLE public.payment_gateways 
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_gateways_tenant_id ON public.payment_gateways(tenant_id);

-- Create unique constraint: one gateway per name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateways_tenant_gateway 
  ON public.payment_gateways(tenant_id, gateway_name) WHERE tenant_id IS NOT NULL;
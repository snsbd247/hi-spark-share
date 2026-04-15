-- Add tenant_id column to admin_sessions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'admin_sessions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.admin_sessions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_tenant_id ON public.admin_sessions(tenant_id);
  END IF;
END $$;
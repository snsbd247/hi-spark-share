-- SMS Wallet for each tenant
CREATE TABLE IF NOT EXISTS public.sms_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_sms_wallets" ON public.sms_wallets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_sms_wallets" ON public.sms_wallets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SMS Transactions (recharge/debit history)
CREATE TABLE IF NOT EXISTS public.sms_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'credit',
  description text,
  admin_id text,
  balance_after integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_sms_transactions" ON public.sms_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_sms_transactions" ON public.sms_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add tenant_id to sms_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_logs' AND column_name = 'tenant_id' AND table_schema = 'public') THEN
    ALTER TABLE public.sms_logs ADD COLUMN tenant_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_logs' AND column_name = 'sms_count' AND table_schema = 'public') THEN
    ALTER TABLE public.sms_logs ADD COLUMN sms_count integer DEFAULT 1;
  END IF;
END $$;
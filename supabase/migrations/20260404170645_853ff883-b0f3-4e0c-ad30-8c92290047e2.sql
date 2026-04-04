
-- Add user_id column to resellers table
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create unique index on user_id (unique per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_resellers_user_id_unique ON public.resellers (user_id) WHERE user_id IS NOT NULL;

-- Add reseller_wallet_transactions table if not exists (already exists but ensure schema)
-- Nothing needed - already exists

-- Update resellers_public view to include user_id
DROP VIEW IF EXISTS public.resellers_public;
CREATE VIEW public.resellers_public AS
SELECT id, tenant_id, user_id, name, company_name, phone, email, address, commission_rate, wallet_balance, status, created_at, updated_at
FROM public.resellers;

-- Grant access
GRANT SELECT ON public.resellers_public TO anon, authenticated;

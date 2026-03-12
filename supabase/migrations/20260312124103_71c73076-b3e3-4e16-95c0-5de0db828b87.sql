ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE,
ADD COLUMN IF NOT EXISTS domain_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS domain_added_at timestamp with time zone;
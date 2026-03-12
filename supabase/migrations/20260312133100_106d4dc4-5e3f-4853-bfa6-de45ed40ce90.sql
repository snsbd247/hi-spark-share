
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS smtp_status text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS smtp_last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS bkash_status text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS bkash_last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS nagad_status text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS nagad_last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_status text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS sms_last_connected_at timestamptz;

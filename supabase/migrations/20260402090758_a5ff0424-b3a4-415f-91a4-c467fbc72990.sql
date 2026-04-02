
-- Add sms_rate to sms_wallets table
ALTER TABLE sms_wallets ADD COLUMN IF NOT EXISTS sms_rate numeric NOT NULL DEFAULT 0.50;

-- Add cost column to sms_logs table
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;

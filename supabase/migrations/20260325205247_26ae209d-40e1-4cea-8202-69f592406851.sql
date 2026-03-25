-- Add missing columns to accounts table for hierarchy support
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS level integer DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
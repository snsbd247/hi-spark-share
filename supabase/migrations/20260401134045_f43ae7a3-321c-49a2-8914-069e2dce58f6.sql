
-- Add smtp_settings table for centralized email configuration
CREATE TABLE IF NOT EXISTS public.smtp_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    host TEXT NOT NULL DEFAULT '',
    port INTEGER NOT NULL DEFAULT 587,
    username TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    encryption TEXT DEFAULT 'tls',
    from_email TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT 'Smart ISP',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add must_change_password to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Enable RLS on smtp_settings
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

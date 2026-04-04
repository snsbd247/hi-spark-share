-- Set default allow_all_packages to true so existing resellers can see packages
ALTER TABLE public.resellers ALTER COLUMN allow_all_packages SET DEFAULT true;
-- Update existing resellers to allow all packages
UPDATE public.resellers SET allow_all_packages = true WHERE allow_all_packages = false;

-- Sync email from auth.users to profiles for all existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email != u.email);

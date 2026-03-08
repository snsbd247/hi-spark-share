
-- Assign super_admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('9a7b4442-e6ee-4419-b9cc-3de732f8f4df', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Set staff_id to ADMIN001
UPDATE public.profiles
SET staff_id = 'ADMIN001'
WHERE id = '9a7b4442-e6ee-4419-b9cc-3de732f8f4df';

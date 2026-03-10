
-- Custom roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  db_role public.app_role NOT NULL DEFAULT 'staff',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permissions table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text,
  UNIQUE(module, action)
);

-- Role permissions junction
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- Add custom_role_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- RLS policies for custom_roles
CREATE POLICY "Authenticated can view custom roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage custom roles" ON public.custom_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS policies for permissions
CREATE POLICY "Authenticated can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage permissions" ON public.permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS policies for role_permissions
CREATE POLICY "Authenticated can view role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage role permissions" ON public.role_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Seed permissions
INSERT INTO public.permissions (module, action, description) VALUES
('customers', 'view', 'View Customers'),
('customers', 'create', 'Create Customer'),
('customers', 'edit', 'Edit Customer'),
('customers', 'delete', 'Delete Customer'),
('billing', 'view', 'View Billing'),
('billing', 'create', 'Create Bill'),
('billing', 'edit', 'Edit Bill'),
('billing', 'delete', 'Delete Bill'),
('payments', 'view', 'View Payments'),
('payments', 'create', 'Create Payment'),
('payments', 'edit', 'Edit Payment'),
('payments', 'delete', 'Delete Payment'),
('merchant_payments', 'view', 'View Merchant Payments'),
('merchant_payments', 'create', 'Create Merchant Payment'),
('merchant_payments', 'edit', 'Edit Merchant Payment'),
('merchant_payments', 'delete', 'Delete Merchant Payment'),
('tickets', 'view', 'View Tickets'),
('tickets', 'create', 'Create Ticket'),
('tickets', 'edit', 'Edit Ticket'),
('tickets', 'delete', 'Delete Ticket'),
('sms', 'view', 'View SMS'),
('sms', 'create', 'Send SMS'),
('sms', 'edit', 'Edit SMS Settings'),
('sms', 'delete', 'Delete SMS'),
('settings', 'view', 'View Settings'),
('settings', 'edit', 'Edit Settings'),
('users', 'view', 'View Users'),
('users', 'create', 'Create User'),
('users', 'edit', 'Edit User'),
('users', 'delete', 'Delete User'),
('roles', 'view', 'View Roles'),
('roles', 'create', 'Create Role'),
('roles', 'edit', 'Edit Role'),
('roles', 'delete', 'Delete Role'),
('reports', 'view', 'View Reports');

-- Seed default roles
INSERT INTO public.custom_roles (name, description, db_role, is_system) VALUES
('Super Admin', 'Full system access with all permissions', 'super_admin', true),
('Admin', 'Administrative access to most features', 'admin', true),
('Manager', 'Management-level access', 'manager', false),
('Operator', 'Day-to-day operational access', 'operator', false),
('Technician', 'Technical and field operations access', 'technician', false),
('Accountant', 'Financial and billing access', 'accountant', false);

-- Give Super Admin all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr CROSS JOIN public.permissions p WHERE cr.name = 'Super Admin';

-- Give Admin most permissions (excluding role management)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr CROSS JOIN public.permissions p WHERE cr.name = 'Admin' AND p.module != 'roles';

-- Create permission check function
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.custom_roles cr ON ur.custom_role_id = cr.id
    JOIN public.role_permissions rp ON rp.role_id = cr.id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = _action
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

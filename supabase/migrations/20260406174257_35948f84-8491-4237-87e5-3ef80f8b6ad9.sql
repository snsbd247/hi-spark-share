INSERT INTO public.custom_roles (name, db_role, description, is_system, tenant_id)
SELECT name, db_role::public.app_role, description, true, null
FROM (VALUES
  ('Super Admin', 'super_admin', 'Full platform access with all permissions'),
  ('Admin', 'admin', 'Tenant administrator with full ISP management access'),
  ('Owner', 'owner', 'Business owner with complete control over tenant operations'),
  ('Manager', 'manager', 'Manages day-to-day operations, customers, and billing'),
  ('Staff', 'staff', 'Handles customer support, basic billing tasks'),
  ('Technician', 'technician', 'Network and fiber infrastructure management'),
  ('Accountant', 'accountant', 'Financial management, accounting, and payroll')
) AS v(name, db_role, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.custom_roles cr WHERE cr.name = v.name AND cr.is_system = true
);
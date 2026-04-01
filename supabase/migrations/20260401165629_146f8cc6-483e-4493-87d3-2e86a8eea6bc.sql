-- 1. MODULES
INSERT INTO public.modules (name, slug, description, icon, is_core, is_active, sort_order) VALUES
  ('Customer Management', 'customers', 'Manage ISP customers', 'Users', true, true, 1),
  ('Billing', 'billing', 'Monthly billing system', 'Receipt', true, true, 2),
  ('Payments', 'payments', 'Payment collection', 'CreditCard', true, true, 3),
  ('Merchant Payments', 'merchant_payments', 'bKash/Nagad merchant', 'Smartphone', false, true, 4),
  ('Support Tickets', 'tickets', 'Customer support', 'Headphones', false, true, 5),
  ('SMS System', 'sms', 'SMS notifications', 'MessageSquare', false, true, 6),
  ('Accounting', 'accounting', 'Double-entry accounting', 'Calculator', false, true, 7),
  ('Inventory', 'inventory', 'Stock management', 'Package', false, true, 8),
  ('Supplier Management', 'supplier', 'Supplier & purchases', 'Truck', false, true, 9),
  ('Reports', 'reports', 'Analytics & reports', 'BarChart3', true, true, 10),
  ('User Management', 'users', 'Staff & users', 'UserCog', true, true, 11),
  ('Roles & Permissions', 'roles', 'RBAC system', 'Shield', true, true, 12),
  ('Settings', 'settings', 'System settings', 'Settings', true, true, 13),
  ('HR & Payroll', 'hr', 'Employee management', 'Briefcase', false, true, 14),
  ('MikroTik', 'mikrotik', 'Router management', 'Router', false, true, 15);

-- 2. SAAS PLANS
INSERT INTO public.saas_plans (name, slug, description, price_monthly, price_yearly, max_customers, max_users, max_routers, has_accounting, has_hr, has_inventory, has_sms, has_custom_domain, features, is_active, sort_order) VALUES
  ('Starter', 'starter', 'Basic ISP management', 999, 9990, 200, 3, 1, false, false, false, false, false, '{"modules":["customers","billing","payments","reports","users","roles","settings"]}', true, 1),
  ('Professional', 'professional', 'Full-featured ISP management', 2499, 24990, 1000, 10, 5, true, true, false, true, true, '{"modules":["customers","billing","payments","merchant_payments","tickets","sms","accounting","reports","users","roles","settings","hr"]}', true, 2),
  ('Enterprise', 'enterprise', 'Unlimited ISP management', 4999, 49990, -1, -1, -1, true, true, true, true, true, '{"modules":["customers","billing","payments","merchant_payments","tickets","sms","accounting","inventory","supplier","reports","users","roles","settings","hr","mikrotik"]}', true, 3);

-- 3. PLAN-MODULE MAPPINGS
INSERT INTO public.plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM public.saas_plans p, public.modules m
WHERE (p.slug = 'starter' AND m.slug IN ('customers','billing','payments','reports','users','roles','settings'))
   OR (p.slug = 'professional' AND m.slug IN ('customers','billing','payments','merchant_payments','tickets','sms','accounting','reports','users','roles','settings','hr'))
   OR (p.slug = 'enterprise');

-- 4. TENANTS
INSERT INTO public.tenants (name, subdomain, email, phone, status, plan, setup_status, setup_geo, setup_accounts, setup_templates, setup_ledger) VALUES
  ('SpeedNet BD', 'speednet', 'admin@speednetbd.com', '01711000001', 'active', 'enterprise', 'completed', true, true, true, true),
  ('FiberLink ISP', 'fiberlink', 'admin@fiberlink.com.bd', '01811000002', 'active', 'professional', 'completed', true, true, true, true),
  ('NetZone IT', 'netzone', 'admin@netzone.com.bd', '01911000003', 'trial', 'starter', 'pending', false, false, false, false);

-- 5. DOMAINS
INSERT INTO public.domains (tenant_id, domain, is_primary, is_verified)
SELECT t.id, t.subdomain || '.smartispsolution.com', true, CASE WHEN t.status = 'active' THEN true ELSE false END
FROM public.tenants t;

-- 6. SUBSCRIPTIONS
INSERT INTO public.subscriptions (tenant_id, plan_id, status, billing_cycle, start_date, end_date, amount)
SELECT t.id, p.id,
  CASE WHEN t.status = 'trial' THEN 'trial' ELSE 'active' END,
  'monthly', CURRENT_DATE,
  CASE WHEN t.plan = 'enterprise' THEN CURRENT_DATE + 365 WHEN t.plan = 'professional' THEN CURRENT_DATE + 180 ELSE CURRENT_DATE + 14 END,
  p.price_monthly
FROM public.tenants t JOIN public.saas_plans p ON p.slug = t.plan;

-- 7. ROLES
INSERT INTO public.custom_roles (name, description, db_role, is_system) VALUES
  ('Super Admin', 'Full system access', 'super_admin', true),
  ('Admin', 'Administrative access', 'admin', true),
  ('Staff', 'Standard staff access', 'staff', true),
  ('Manager', 'Manager access', 'manager', true),
  ('Operator', 'Operator access', 'operator', true),
  ('Technician', 'Technician access', 'technician', true),
  ('Accountant', 'Accounting access', 'accountant', true);

-- 8. TENANT ADMIN USERS (with explicit gen_random_uuid for id)
INSERT INTO public.profiles (id, tenant_id, full_name, email, username, password_hash, status, language)
SELECT gen_random_uuid(), t.id, t.name || ' Admin', t.email, t.subdomain || '_admin',
  '$2a$10$SOl0xgUhV2HHDj5U2HElkuEqH3WtPThxsVDl.ZGd.DKFH4PK0/JTG', 'active', 'bn'
FROM public.tenants t;

-- 9. USER ROLES
INSERT INTO public.user_roles (user_id, role, custom_role_id)
SELECT p.id, 'admin', r.id
FROM public.profiles p JOIN public.custom_roles r ON r.name = 'Admin'
WHERE p.tenant_id IS NOT NULL;

-- 10. PERMISSIONS
DO $$
DECLARE
  mods text[] := ARRAY['customers','billing','payments','merchant_payments','tickets','sms','accounting','inventory','hr','supplier','reports','settings','users','roles'];
  acts text[] := ARRAY['view','create','edit','delete'];
  m text; a text;
BEGIN
  FOREACH m IN ARRAY mods LOOP
    FOREACH a IN ARRAY acts LOOP
      INSERT INTO public.permissions (module, action, description) VALUES (m, a, initcap(a) || ' ' || replace(m, '_', ' '));
    END LOOP;
  END LOOP;
END $$;

-- 11. ROLE PERMISSIONS
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.custom_roles r, public.permissions p WHERE r.name IN ('Super Admin', 'Admin');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.custom_roles r, public.permissions p
WHERE r.name = 'Manager' AND NOT (p.module = 'users' AND p.action = 'delete') AND NOT (p.module = 'roles' AND p.action IN ('create','edit','delete')) AND NOT (p.module = 'settings' AND p.action = 'delete');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.custom_roles r, public.permissions p
WHERE r.name = 'Staff' AND (p.action = 'view' OR p.module IN ('customers','billing','payments','merchant_payments','tickets','sms'));

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.custom_roles r, public.permissions p
WHERE r.name = 'Operator' AND (p.action = 'view' OR (p.module IN ('customers','billing','payments','tickets') AND p.action != 'delete'));

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.custom_roles r, public.permissions p
WHERE r.name = 'Technician' AND ((p.module = 'customers' AND p.action = 'view') OR p.module = 'tickets' OR (p.module = 'reports' AND p.action = 'view'));

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.custom_roles r, public.permissions p
WHERE r.name = 'Accountant' AND (p.module IN ('accounting','payments','billing','merchant_payments','reports','supplier','inventory','hr') OR (p.module = 'customers' AND p.action = 'view'));
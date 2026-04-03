-- Seed role_permissions for all 7 roles
-- Super Admin (all 64 perms)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), 'a9bb72a1-7982-4428-99a2-8647f59ccf04', p.id
FROM permissions p
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'a9bb72a1-7982-4428-99a2-8647f59ccf04' AND rp.permission_id = p.id);

-- Admin (all 64 perms)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), 'c3a9e0a5-995b-40c6-ad2f-3dc0ebc6e300', p.id
FROM permissions p
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'c3a9e0a5-995b-40c6-ad2f-3dc0ebc6e300' AND rp.permission_id = p.id);

-- Owner (all 64 perms)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), '12c3f381-81d5-4927-a8bf-8a5d753e61d7', p.id
FROM permissions p
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = '12c3f381-81d5-4927-a8bf-8a5d753e61d7' AND rp.permission_id = p.id);

-- Manager (all except users.create, users.delete, roles.create, roles.edit, roles.delete, settings.delete)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), '397a6516-f6c5-4da5-8618-f0c50dc97b02', p.id
FROM permissions p
WHERE NOT (
  (p.module = 'users' AND p.action IN ('create', 'delete')) OR
  (p.module = 'roles' AND p.action IN ('create', 'edit', 'delete')) OR
  (p.module = 'settings' AND p.action = 'delete')
)
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = '397a6516-f6c5-4da5-8618-f0c50dc97b02' AND rp.permission_id = p.id);

-- Staff (view all + CRUD on core modules: customers, billing, payments, merchant_payments, tickets, sms, packages)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), 'd8e73220-315d-4b56-9cb5-da2af9466624', p.id
FROM permissions p
WHERE (
  p.action = 'view'
  OR p.module IN ('customers', 'billing', 'payments', 'merchant_payments', 'tickets', 'sms', 'packages')
)
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'd8e73220-315d-4b56-9cb5-da2af9466624' AND rp.permission_id = p.id);

-- Technician (customers.view, tickets.*, mikrotik.*, reports.view)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), '24044939-0ca3-426c-9286-7d202d120227', p.id
FROM permissions p
WHERE (
  (p.module = 'customers' AND p.action = 'view')
  OR p.module = 'tickets'
  OR p.module = 'mikrotik'
  OR (p.module = 'reports' AND p.action = 'view')
)
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = '24044939-0ca3-426c-9286-7d202d120227' AND rp.permission_id = p.id);

-- Accountant (accounting.*, payments.*, billing.*, merchant_payments.*, reports.*, supplier.*, inventory.*, hr.*, customers.view)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), '1074cf77-7a5d-4145-a3aa-c071378d7ab1', p.id
FROM permissions p
WHERE (
  p.module IN ('accounting', 'payments', 'billing', 'merchant_payments', 'reports', 'supplier', 'inventory', 'hr')
  OR (p.module = 'customers' AND p.action = 'view')
)
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = '1074cf77-7a5d-4145-a3aa-c071378d7ab1' AND rp.permission_id = p.id);
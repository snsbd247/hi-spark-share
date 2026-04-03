-- Add missing permission modules: merchant_payments and supplier
INSERT INTO permissions (id, module, action, description) VALUES
  (gen_random_uuid(), 'merchant_payments', 'view', 'View merchant payments'),
  (gen_random_uuid(), 'merchant_payments', 'create', 'Create merchant payments'),
  (gen_random_uuid(), 'merchant_payments', 'edit', 'Edit merchant payments'),
  (gen_random_uuid(), 'merchant_payments', 'delete', 'Delete merchant payments'),
  (gen_random_uuid(), 'supplier', 'view', 'View supplier'),
  (gen_random_uuid(), 'supplier', 'create', 'Create supplier'),
  (gen_random_uuid(), 'supplier', 'edit', 'Edit supplier'),
  (gen_random_uuid(), 'supplier', 'delete', 'Delete supplier')
ON CONFLICT DO NOTHING;
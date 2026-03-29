-- Add inventory module permissions
INSERT INTO permissions (module, action, description) VALUES
  ('inventory', 'view', 'View inventory'),
  ('inventory', 'create', 'Create inventory'),
  ('inventory', 'edit', 'Edit inventory'),
  ('inventory', 'delete', 'Delete inventory')
ON CONFLICT (module, action) DO NOTHING;

-- Ensure reports and settings have full CRUD
INSERT INTO permissions (module, action, description) VALUES
  ('reports', 'create', 'Create reports'),
  ('reports', 'edit', 'Edit reports'),
  ('reports', 'delete', 'Delete reports'),
  ('settings', 'create', 'Create settings'),
  ('settings', 'delete', 'Delete settings')
ON CONFLICT (module, action) DO NOTHING;
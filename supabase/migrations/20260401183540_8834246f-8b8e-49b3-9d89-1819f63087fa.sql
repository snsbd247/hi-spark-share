
-- Drop global unique constraint on staff_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_staff_id_key;

-- Add composite unique constraint (tenant_id + staff_id) to allow same staff_id across tenants
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tenant_staff_id_unique ON profiles (tenant_id, staff_id) WHERE staff_id IS NOT NULL;

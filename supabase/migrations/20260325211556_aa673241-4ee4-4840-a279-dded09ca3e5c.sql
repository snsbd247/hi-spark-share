ALTER TABLE admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_admin_id_fkey;
ALTER TABLE admin_login_logs DROP CONSTRAINT IF EXISTS admin_login_logs_admin_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
ALTER TABLE backup_logs DROP CONSTRAINT IF EXISTS backup_logs_created_by_fkey;
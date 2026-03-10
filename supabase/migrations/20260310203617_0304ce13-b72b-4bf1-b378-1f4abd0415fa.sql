
-- Create backup_logs table
CREATE TABLE public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  backup_type text NOT NULL DEFAULT 'manual',
  file_size bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_access" ON public.backup_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false);

-- RLS for backups bucket - only authenticated users
CREATE POLICY "authenticated_read_backups" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'backups');

CREATE POLICY "authenticated_insert_backups" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups');

CREATE POLICY "authenticated_delete_backups" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'backups');

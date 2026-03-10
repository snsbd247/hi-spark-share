
-- Create emergency backups storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('emergency', 'emergency', false);

-- RLS for emergency bucket
CREATE POLICY "authenticated_read_emergency" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'emergency');

CREATE POLICY "authenticated_insert_emergency" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'emergency');

CREATE POLICY "authenticated_delete_emergency" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'emergency');

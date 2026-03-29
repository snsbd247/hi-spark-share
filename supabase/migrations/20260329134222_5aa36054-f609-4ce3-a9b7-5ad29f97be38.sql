CREATE POLICY "Allow anon to read backups" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'backups');

CREATE POLICY "Allow anon to read emergency backups" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'emergency');
CREATE POLICY "Allow select smtp_settings" ON public.smtp_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert smtp_settings" ON public.smtp_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update smtp_settings" ON public.smtp_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete smtp_settings" ON public.smtp_settings FOR DELETE TO authenticated USING (true);

-- Allow service role full access to super_admins
CREATE POLICY "service_role_all_super_admins" ON public.super_admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow service role full access to super_admin_sessions
CREATE POLICY "service_role_all_super_admin_sessions" ON public.super_admin_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Also allow anon for edge function access (edge functions use anon key by default)
CREATE POLICY "anon_read_super_admins" ON public.super_admins
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_all_super_admins" ON public.super_admins
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_super_admin_sessions" ON public.super_admin_sessions
  FOR ALL TO anon USING (true) WITH CHECK (true);

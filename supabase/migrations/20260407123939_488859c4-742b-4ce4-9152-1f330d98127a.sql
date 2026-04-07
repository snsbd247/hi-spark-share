
-- Grant permissions on admin_sessions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_sessions TO service_role;

-- Also ensure admin_login_logs has proper grants
GRANT SELECT, INSERT ON public.admin_login_logs TO anon;
GRANT SELECT, INSERT ON public.admin_login_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_logs TO service_role;

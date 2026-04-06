-- Remove anon ALL from sensitive tables (edge functions use service_role)

-- admin_sessions: edge function uses service_role for login
DROP POLICY IF EXISTS "anon_access" ON public.admin_sessions;
CREATE POLICY "anon_select_admin_sessions" ON public.admin_sessions
  FOR SELECT TO anon USING (true);

-- admin_login_logs: only written by edge function with service_role
DROP POLICY IF EXISTS "anon_access" ON public.admin_login_logs;

-- audit_logs: internal system only
DROP POLICY IF EXISTS "anon_access" ON public.audit_logs;

-- backup_logs: admin-only feature
DROP POLICY IF EXISTS "anon_access" ON public.backup_logs;

-- login_histories: sensitive login data
DROP POLICY IF EXISTS "anon_access" ON public.login_histories;

-- impersonations: super admin only
DROP POLICY IF EXISTS "anon_access" ON public.impersonations;

-- user_roles: RBAC system - read needed, write via service_role
DROP POLICY IF EXISTS "anon_access" ON public.user_roles;
CREATE POLICY "anon_select_user_roles" ON public.user_roles
  FOR SELECT TO anon USING (true);

-- role_permissions: RBAC system  
DROP POLICY IF EXISTS "anon_access" ON public.role_permissions;
CREATE POLICY "anon_select_role_permissions" ON public.role_permissions
  FOR SELECT TO anon USING (true);

-- permissions: read-only reference data
DROP POLICY IF EXISTS "anon_access" ON public.permissions;
CREATE POLICY "anon_select_permissions" ON public.permissions
  FOR SELECT TO anon USING (true);

-- profiles: read needed for auth, write via service_role
DROP POLICY IF EXISTS "anon_access" ON public.profiles;
CREATE POLICY "anon_select_profiles" ON public.profiles
  FOR SELECT TO anon USING (true);

-- custom_roles: read needed for UI, write via admin
DROP POLICY IF EXISTS "anon_access" ON public.custom_roles;
CREATE POLICY "anon_select_custom_roles" ON public.custom_roles
  FOR SELECT TO anon USING (true);

-- customer_sessions: edge function uses service_role
DROP POLICY IF EXISTS "anon_access" ON public.customer_sessions;
CREATE POLICY "anon_select_customer_sessions" ON public.customer_sessions
  FOR SELECT TO anon USING (true);

-- merchant_payments: sensitive payment data
DROP POLICY IF EXISTS "anon_access" ON public.merchant_payments;
CREATE POLICY "anon_select_merchant_payments" ON public.merchant_payments
  FOR SELECT TO anon USING (true);

-- subscription data: super admin managed
DROP POLICY IF EXISTS "anon_access" ON public.subscriptions;
CREATE POLICY "anon_select_subscriptions" ON public.subscriptions
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_access" ON public.subscription_invoices;
CREATE POLICY "anon_select_subscription_invoices" ON public.subscription_invoices
  FOR SELECT TO anon USING (true);

-- saas_plans: read-only for plan display
DROP POLICY IF EXISTS "anon_access" ON public.saas_plans;
CREATE POLICY "anon_select_saas_plans" ON public.saas_plans
  FOR SELECT TO anon USING (true);

-- sms_logs: written by edge function with service_role
DROP POLICY IF EXISTS "anon_access" ON public.sms_logs;
CREATE POLICY "anon_select_sms_logs" ON public.sms_logs
  FOR SELECT TO anon USING (true);

-- mikrotik_routers: network credentials
DROP POLICY IF EXISTS "anon_access" ON public.mikrotik_routers;
CREATE POLICY "anon_select_mikrotik_routers" ON public.mikrotik_routers
  FOR SELECT TO anon USING (true);

-- ip_pools: network infrastructure
DROP POLICY IF EXISTS "anon_access" ON public.ip_pools;
CREATE POLICY "anon_select_ip_pools" ON public.ip_pools
  FOR SELECT TO anon USING (true);
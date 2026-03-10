
-- ============================================================
-- STEP 1: Drop ALL existing RLS policies that reference has_role()
-- ============================================================

-- admin_login_logs
DROP POLICY IF EXISTS "Super admins can view all login logs" ON public.admin_login_logs;
DROP POLICY IF EXISTS "Users can insert own login logs" ON public.admin_login_logs;
DROP POLICY IF EXISTS "Users can view own login logs" ON public.admin_login_logs;

-- admin_sessions
DROP POLICY IF EXISTS "Super admins can manage all sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.admin_sessions;

-- audit_logs
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- bills
DROP POLICY IF EXISTS "Admins can manage bills" ON public.bills;
DROP POLICY IF EXISTS "Staff can view bills" ON public.bills;

-- custom_roles
DROP POLICY IF EXISTS "Authenticated can view custom roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Super admins can manage custom roles" ON public.custom_roles;

-- customer_ledger
DROP POLICY IF EXISTS "Admins can manage ledger" ON public.customer_ledger;
DROP POLICY IF EXISTS "Staff can view ledger" ON public.customer_ledger;

-- customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;

-- general_settings
DROP POLICY IF EXISTS "Admins can manage general settings" ON public.general_settings;
DROP POLICY IF EXISTS "Anyone can read general settings" ON public.general_settings;

-- merchant_payments
DROP POLICY IF EXISTS "Admins can manage merchant payments" ON public.merchant_payments;
DROP POLICY IF EXISTS "Staff can view merchant payments" ON public.merchant_payments;

-- mikrotik_routers
DROP POLICY IF EXISTS "Admins can manage mikrotik routers" ON public.mikrotik_routers;
DROP POLICY IF EXISTS "Staff can view mikrotik routers" ON public.mikrotik_routers;

-- olts
DROP POLICY IF EXISTS "Admins can manage OLTs" ON public.olts;
DROP POLICY IF EXISTS "Staff can view OLTs" ON public.olts;

-- onus
DROP POLICY IF EXISTS "Admins can manage ONUs" ON public.onus;
DROP POLICY IF EXISTS "Staff can view ONUs" ON public.onus;

-- packages
DROP POLICY IF EXISTS "Admins can manage packages" ON public.packages;
DROP POLICY IF EXISTS "Anyone can read packages" ON public.packages;

-- payment_gateways
DROP POLICY IF EXISTS "Admins can view payment gateways" ON public.payment_gateways;
DROP POLICY IF EXISTS "Super admins can manage payment gateways" ON public.payment_gateways;

-- payments
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;

-- permissions
DROP POLICY IF EXISTS "Authenticated can view permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admins can manage permissions" ON public.permissions;

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- reminder_logs
DROP POLICY IF EXISTS "Admins can manage reminder logs" ON public.reminder_logs;

-- role_permissions
DROP POLICY IF EXISTS "Authenticated can view role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Super admins can manage role permissions" ON public.role_permissions;

-- sms_logs
DROP POLICY IF EXISTS "Admins can manage sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Staff can view sms logs" ON public.sms_logs;

-- sms_settings
DROP POLICY IF EXISTS "Admins can manage sms settings" ON public.sms_settings;

-- support_tickets
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anon can insert tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anon can read tickets" ON public.support_tickets;

-- ticket_replies
DROP POLICY IF EXISTS "Admins can manage replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Anon can insert replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Anon can read replies" ON public.ticket_replies;

-- user_roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- zones
DROP POLICY IF EXISTS "Admins can manage zones" ON public.zones;
DROP POLICY IF EXISTS "Anyone can read zones" ON public.zones;
DROP POLICY IF EXISTS "Staff can view zones" ON public.zones;

-- ============================================================
-- STEP 2: Create simple authenticated-access policies
-- Permission enforcement is handled in application code
-- ============================================================

-- admin_login_logs
CREATE POLICY "authenticated_access" ON public.admin_login_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- admin_sessions
CREATE POLICY "authenticated_access" ON public.admin_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- audit_logs
CREATE POLICY "authenticated_access" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bills
CREATE POLICY "authenticated_access" ON public.bills FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- custom_roles
CREATE POLICY "authenticated_access" ON public.custom_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- customer_ledger
CREATE POLICY "authenticated_access" ON public.customer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- customer_sessions (no RLS currently, keep it simple)
CREATE POLICY "authenticated_access" ON public.customer_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- customers
CREATE POLICY "authenticated_access" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- general_settings (needs anon read for customer portal)
CREATE POLICY "authenticated_access" ON public.general_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON public.general_settings FOR SELECT TO anon USING (true);

-- merchant_payments
CREATE POLICY "authenticated_access" ON public.merchant_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mikrotik_routers
CREATE POLICY "authenticated_access" ON public.mikrotik_routers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- olts
CREATE POLICY "authenticated_access" ON public.olts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- onus
CREATE POLICY "authenticated_access" ON public.onus FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- packages (needs anon read for customer portal)
CREATE POLICY "authenticated_access" ON public.packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON public.packages FOR SELECT TO anon USING (true);

-- payment_gateways
CREATE POLICY "authenticated_access" ON public.payment_gateways FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- payments
CREATE POLICY "authenticated_access" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- permissions
CREATE POLICY "authenticated_access" ON public.permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- profiles
CREATE POLICY "authenticated_access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- reminder_logs
CREATE POLICY "authenticated_access" ON public.reminder_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- role_permissions
CREATE POLICY "authenticated_access" ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sms_logs
CREATE POLICY "authenticated_access" ON public.sms_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sms_settings
CREATE POLICY "authenticated_access" ON public.sms_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- support_tickets (needs anon access for customer portal)
CREATE POLICY "authenticated_access" ON public.support_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON public.support_tickets FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON public.support_tickets FOR INSERT TO anon WITH CHECK (customer_id IS NOT NULL AND subject IS NOT NULL);

-- ticket_replies (needs anon access for customer portal)
CREATE POLICY "authenticated_access" ON public.ticket_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON public.ticket_replies FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON public.ticket_replies FOR INSERT TO anon WITH CHECK (ticket_id IS NOT NULL AND message IS NOT NULL AND sender_name IS NOT NULL);

-- user_roles
CREATE POLICY "authenticated_access" ON public.user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- zones (needs anon read)
CREATE POLICY "authenticated_access" ON public.zones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON public.zones FOR SELECT TO anon USING (true);

-- ============================================================
-- STEP 3: Drop DB functions (logic moved to Edge Functions)
-- ============================================================

-- Drop trigger first (on auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_permission(uuid, text, text) CASCADE;

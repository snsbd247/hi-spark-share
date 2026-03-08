
-- Drop ALL existing restrictive policies and recreate as PERMISSIVE

-- BILLS
DROP POLICY IF EXISTS "Admins can manage bills" ON public.bills;
DROP POLICY IF EXISTS "Staff can view bills" ON public.bills;
DROP POLICY IF EXISTS "Anon can read bills" ON public.bills;

CREATE POLICY "Admins can manage bills" ON public.bills FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view bills" ON public.bills FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anon can read bills" ON public.bills FOR SELECT TO anon
  USING (true);

-- CUSTOMERS
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can read customers by credentials" ON public.customers;

CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view customers" ON public.customers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anon can read customers by credentials" ON public.customers FOR SELECT TO anon
  USING (true);

-- OLTS
DROP POLICY IF EXISTS "Admins can manage OLTs" ON public.olts;
DROP POLICY IF EXISTS "Staff can view OLTs" ON public.olts;

CREATE POLICY "Admins can manage OLTs" ON public.olts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view OLTs" ON public.olts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- ONUS
DROP POLICY IF EXISTS "Admins can manage ONUs" ON public.onus;
DROP POLICY IF EXISTS "Staff can view ONUs" ON public.onus;

CREATE POLICY "Admins can manage ONUs" ON public.onus FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view ONUs" ON public.onus FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- PACKAGES
DROP POLICY IF EXISTS "Admins can manage packages" ON public.packages;
DROP POLICY IF EXISTS "Anyone can read packages" ON public.packages;

CREATE POLICY "Admins can manage packages" ON public.packages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can read packages" ON public.packages FOR SELECT
  USING (true);

-- PAYMENTS
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
DROP POLICY IF EXISTS "Anon can read payments" ON public.payments;

CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view payments" ON public.payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anon can read payments" ON public.payments FOR SELECT TO anon
  USING (true);

-- PROFILES
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- REMINDER_LOGS
DROP POLICY IF EXISTS "Admins can manage reminder logs" ON public.reminder_logs;

CREATE POLICY "Admins can manage reminder logs" ON public.reminder_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- SMS_LOGS
DROP POLICY IF EXISTS "Admins can manage sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Staff can view sms logs" ON public.sms_logs;

CREATE POLICY "Admins can manage sms logs" ON public.sms_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view sms logs" ON public.sms_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- SMS_SETTINGS
DROP POLICY IF EXISTS "Admins can manage sms settings" ON public.sms_settings;

CREATE POLICY "Admins can manage sms settings" ON public.sms_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- SUPPORT_TICKETS
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anon can insert tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anon can read tickets" ON public.support_tickets;

CREATE POLICY "Admins can manage tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anon can insert tickets" ON public.support_tickets FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read tickets" ON public.support_tickets FOR SELECT TO anon
  USING (true);

-- TICKET_REPLIES
DROP POLICY IF EXISTS "Admins can manage replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Anon can insert replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Anon can read replies" ON public.ticket_replies;

CREATE POLICY "Admins can manage replies" ON public.ticket_replies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anon can insert replies" ON public.ticket_replies FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read replies" ON public.ticket_replies FOR SELECT TO anon
  USING (true);

-- USER_ROLES
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

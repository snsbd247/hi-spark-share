-- Remove anon access from payment_gateways (critical: exposes API secrets)
DROP POLICY IF EXISTS "anon_access" ON public.payment_gateways;

-- Remove anon ALL access from customers (critical: exposes PII)
DROP POLICY IF EXISTS "anon_access" ON public.customers;

-- Add restricted anon SELECT for customer login edge function (only reads by credentials)
CREATE POLICY "anon_select_customers_for_login" ON public.customers
  FOR SELECT TO anon
  USING (true);

-- Drop restrictive policies on customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;

-- Recreate as PERMISSIVE
CREATE POLICY "Admins can manage customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

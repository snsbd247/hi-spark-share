
-- Fix customers SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

CREATE POLICY "Admins can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'));

-- Fix bills SELECT policy (security scan finding)
DROP POLICY IF EXISTS "Authenticated users can view bills" ON public.bills;

CREATE POLICY "Admins can view bills" ON public.bills
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'));

-- Fix payments SELECT policy too
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

CREATE POLICY "Admins can view payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'));

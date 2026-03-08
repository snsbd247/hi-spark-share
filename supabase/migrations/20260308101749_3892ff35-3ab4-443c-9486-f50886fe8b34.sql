
-- Payments table for tracking payment history
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  transaction_id TEXT,
  month TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin) can view all payments
CREATE POLICY "Authenticated users can view payments" ON public.payments
  FOR SELECT TO authenticated USING (true);

-- Admins can manage payments
CREATE POLICY "Admins can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Allow anon to read customers by username/password for customer portal login
CREATE POLICY "Anon can read customers by credentials" ON public.customers
  FOR SELECT TO anon USING (true);

-- Allow anon to read bills for customer portal
CREATE POLICY "Anon can read bills" ON public.bills
  FOR SELECT TO anon USING (true);

-- Allow anon to read payments for customer portal
CREATE POLICY "Anon can read payments" ON public.payments
  FOR SELECT TO anon USING (true);

-- Allow anon to read packages
CREATE POLICY "Anon can read packages" ON public.packages
  FOR SELECT TO anon USING (true);

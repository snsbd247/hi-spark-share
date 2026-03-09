
-- Drop anon read policies from bills, payments, and customer_ledger
DROP POLICY IF EXISTS "Anon can read bills" ON public.bills;
DROP POLICY IF EXISTS "Anon can read payments" ON public.payments;
DROP POLICY IF EXISTS "Anon can read ledger" ON public.customer_ledger;

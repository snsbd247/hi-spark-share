
-- Provident Fund transactions
CREATE TABLE public.employee_provident_fund (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'contribution', -- contribution, withdrawal, interest
  amount NUMERIC NOT NULL DEFAULT 0,
  employee_share NUMERIC NOT NULL DEFAULT 0,
  employer_share NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_provident_fund ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON public.employee_provident_fund FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Savings Fund transactions
CREATE TABLE public.employee_savings_fund (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'deposit', -- deposit, withdrawal, interest
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_savings_fund ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON public.employee_savings_fund FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add PF/Savings deduction columns to salary_sheets
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS pf_deduction NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS savings_deduction NUMERIC NOT NULL DEFAULT 0;

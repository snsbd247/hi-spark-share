
-- Employee salary structure
CREATE TABLE public.employee_salary_structure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  house_rent NUMERIC NOT NULL DEFAULT 0,
  medical NUMERIC NOT NULL DEFAULT 0,
  conveyance NUMERIC NOT NULL DEFAULT 0,
  other_allowance NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_salary_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON public.employee_salary_structure FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee education history
CREATE TABLE public.employee_education (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  degree TEXT NOT NULL,
  institution TEXT NOT NULL,
  board_university TEXT,
  passing_year TEXT,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON public.employee_education FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee experience history
CREATE TABLE public.employee_experience (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  from_date DATE,
  to_date DATE,
  responsibilities TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON public.employee_experience FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee emergency contacts
CREATE TABLE public.employee_emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  relation TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON public.employee_emergency_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add salary structure columns to salary_sheets
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS house_rent NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS medical NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS conveyance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS other_allowance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

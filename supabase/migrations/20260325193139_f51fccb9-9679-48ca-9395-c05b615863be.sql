
-- Seed demo data
INSERT INTO public.designations (name, description) VALUES
  ('Manager', 'Manages overall operations'),
  ('Technician', 'Handles technical installations and repairs'),
  ('Customer Support', 'Handles customer inquiries and complaints'),
  ('Accountant', 'Manages financial records'),
  ('Network Engineer', 'Manages network infrastructure');

INSERT INTO public.employees (employee_id, name, phone, email, designation_id, joining_date, salary, address) VALUES
  ('EMP-001', 'Karim Hossain', '01711223344', 'karim@smartisp.com', (SELECT id FROM public.designations WHERE name='Manager' LIMIT 1), '2024-01-15', 35000, 'Mirpur, Dhaka'),
  ('EMP-002', 'Jamal Uddin', '01822334455', 'jamal@smartisp.com', (SELECT id FROM public.designations WHERE name='Technician' LIMIT 1), '2024-03-01', 18000, 'Uttara, Dhaka'),
  ('EMP-003', 'Fatema Akter', '01933445566', 'fatema@smartisp.com', (SELECT id FROM public.designations WHERE name='Customer Support' LIMIT 1), '2024-06-10', 15000, 'Dhanmondi, Dhaka'),
  ('EMP-004', 'Rafiq Ahmed', '01644556677', 'rafiq@smartisp.com', (SELECT id FROM public.designations WHERE name='Accountant' LIMIT 1), '2024-02-20', 25000, 'Farmgate, Dhaka'),
  ('EMP-005', 'Sumon Islam', '01555667788', 'sumon@smartisp.com', (SELECT id FROM public.designations WHERE name='Network Engineer' LIMIT 1), '2024-04-05', 28000, 'Mohammadpur, Dhaka');

INSERT INTO public.attendance (employee_id, date, status, check_in, check_out) 
SELECT e.id, d.dt::date, 
  CASE WHEN random() > 0.85 THEN 'absent' WHEN random() > 0.7 THEN 'late' ELSE 'present' END,
  CASE WHEN random() > 0.15 THEN '09:00'::time ELSE NULL END,
  CASE WHEN random() > 0.15 THEN '18:00'::time ELSE NULL END
FROM public.employees e
CROSS JOIN generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS d(dt)
ON CONFLICT (employee_id, date) DO NOTHING;

INSERT INTO public.loans (employee_id, amount, paid_amount, monthly_deduction, reason, status, approved_date) VALUES
  ((SELECT id FROM public.employees WHERE employee_id='EMP-002'), 50000, 10000, 5000, 'Home renovation', 'active', '2025-01-15'),
  ((SELECT id FROM public.employees WHERE employee_id='EMP-003'), 30000, 30000, 5000, 'Medical emergency', 'completed', '2024-09-01');

INSERT INTO public.salary_sheets (employee_id, month, basic_salary, bonus, deduction, loan_deduction, net_salary, status, paid_date)
SELECT e.id, '2026-02', e.salary, 0, 0, 
  COALESCE((SELECT l.monthly_deduction FROM public.loans l WHERE l.employee_id = e.id AND l.status = 'active' LIMIT 1), 0),
  e.salary - COALESCE((SELECT l.monthly_deduction FROM public.loans l WHERE l.employee_id = e.id AND l.status = 'active' LIMIT 1), 0),
  'paid', '2026-02-28'
FROM public.employees e
ON CONFLICT (employee_id, month) DO NOTHING;

INSERT INTO public.salary_sheets (employee_id, month, basic_salary, bonus, deduction, loan_deduction, net_salary, status)
SELECT e.id, '2026-03', e.salary, 0, 0, 
  COALESCE((SELECT l.monthly_deduction FROM public.loans l WHERE l.employee_id = e.id AND l.status = 'active' LIMIT 1), 0),
  e.salary - COALESCE((SELECT l.monthly_deduction FROM public.loans l WHERE l.employee_id = e.id AND l.status = 'active' LIMIT 1), 0),
  'pending'
FROM public.employees e
ON CONFLICT (employee_id, month) DO NOTHING;

INSERT INTO public.accounts (name, code, type, balance) VALUES
  ('Cash', '1001', 'asset', 125000),
  ('Bank - City Bank', '1002', 'asset', 350000),
  ('Accounts Receivable', '1003', 'asset', 45000),
  ('Equipment', '1004', 'asset', 200000),
  ('Accounts Payable', '2001', 'liability', 35000),
  ('Salary Payable', '2002', 'liability', 121000),
  ('Owner Equity', '3001', 'equity', 500000),
  ('Internet Service Income', '4001', 'income', 270500),
  ('Installation Income', '4002', 'income', 15000),
  ('Salary Expense', '5001', 'expense', 121000),
  ('Electricity Expense', '5002', 'expense', 18000),
  ('Rent Expense', '5003', 'expense', 25000),
  ('Maintenance Expense', '5004', 'expense', 8500);

INSERT INTO public.income_heads (name, description) VALUES
  ('Internet Service', 'Monthly internet subscription income'),
  ('Installation Fee', 'One-time connection setup fee'),
  ('Reconnection Fee', 'Fee for reconnecting suspended accounts'),
  ('Equipment Sales', 'Router and cable sales');

INSERT INTO public.expense_heads (name, description) VALUES
  ('Salary', 'Employee salaries and wages'),
  ('Electricity', 'Office and server room electricity'),
  ('Rent', 'Office space rent'),
  ('Internet Bandwidth', 'Upstream bandwidth purchase'),
  ('Maintenance', 'Equipment and network maintenance'),
  ('Transport', 'Travel and transport expenses');

INSERT INTO public.other_heads (name, type, description) VALUES
  ('Depreciation', 'adjustment', 'Equipment depreciation'),
  ('Bad Debt', 'write_off', 'Uncollectible customer dues'),
  ('Miscellaneous', 'other', 'Other miscellaneous items');

INSERT INTO public.transactions (date, description, debit, credit, account_id, reference, type) VALUES
  (now() - interval '30 days', 'Monthly bandwidth purchase', 45000, 0, (SELECT id FROM public.accounts WHERE code='5004'), 'TXN-001', 'expense'),
  (now() - interval '30 days', 'Monthly bandwidth purchase', 0, 45000, (SELECT id FROM public.accounts WHERE code='1001'), 'TXN-001', 'expense'),
  (now() - interval '25 days', 'Salary payment - February', 121000, 0, (SELECT id FROM public.accounts WHERE code='5001'), 'TXN-002', 'expense'),
  (now() - interval '25 days', 'Salary payment - February', 0, 121000, (SELECT id FROM public.accounts WHERE code='1002'), 'TXN-002', 'expense'),
  (now() - interval '20 days', 'Customer payments received', 0, 85000, (SELECT id FROM public.accounts WHERE code='4001'), 'TXN-003', 'income'),
  (now() - interval '20 days', 'Customer payments received', 85000, 0, (SELECT id FROM public.accounts WHERE code='1002'), 'TXN-003', 'income'),
  (now() - interval '15 days', 'Electricity bill', 18000, 0, (SELECT id FROM public.accounts WHERE code='5002'), 'TXN-004', 'expense'),
  (now() - interval '15 days', 'Electricity bill', 0, 18000, (SELECT id FROM public.accounts WHERE code='1001'), 'TXN-004', 'expense'),
  (now() - interval '10 days', 'Office rent', 25000, 0, (SELECT id FROM public.accounts WHERE code='5003'), 'TXN-005', 'expense'),
  (now() - interval '10 days', 'Office rent', 0, 25000, (SELECT id FROM public.accounts WHERE code='1001'), 'TXN-005', 'expense'),
  (now() - interval '5 days', 'Installation fees collected', 0, 15000, (SELECT id FROM public.accounts WHERE code='4002'), 'TXN-006', 'income'),
  (now() - interval '5 days', 'Installation fees collected', 15000, 0, (SELECT id FROM public.accounts WHERE code='1001'), 'TXN-006', 'income');

INSERT INTO public.suppliers (name, phone, email, company, address, total_due) VALUES
  ('Fiber Optic BD', '01911234567', 'sales@fiberopticbd.com', 'Fiber Optic BD Ltd', 'Banani, Dhaka', 25000),
  ('Network Solutions', '01822345678', 'info@netsol.com', 'Network Solutions Co.', 'Gulshan, Dhaka', 15000),
  ('Cable House', '01733456789', 'order@cablehouse.com', 'Cable House Trading', 'Motijheel, Dhaka', 0);

INSERT INTO public.supplier_payments (supplier_id, amount, payment_method, reference, notes, paid_date) VALUES
  ((SELECT id FROM public.suppliers WHERE name='Fiber Optic BD'), 50000, 'bank_transfer', 'SP-001', 'Fiber cable purchase', now() - interval '20 days'),
  ((SELECT id FROM public.suppliers WHERE name='Fiber Optic BD'), 25000, 'cash', 'SP-002', 'ONU devices', now() - interval '10 days'),
  ((SELECT id FROM public.suppliers WHERE name='Network Solutions'), 35000, 'bank_transfer', 'SP-003', 'Switch and router purchase', now() - interval '15 days');

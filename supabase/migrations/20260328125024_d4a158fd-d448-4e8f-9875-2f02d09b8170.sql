
-- Delete all data EXCEPT profiles, user_roles, custom_roles, role_permissions, permissions
DELETE FROM public.sms_logs;
DELETE FROM public.reminder_logs;
DELETE FROM public.customer_ledger;
DELETE FROM public.customer_sessions;
DELETE FROM public.merchant_payments;
DELETE FROM public.sale_items;
DELETE FROM public.sales;
DELETE FROM public.purchase_items;
DELETE FROM public.purchases;
DELETE FROM public.products;
DELETE FROM public.expenses;
DELETE FROM public.expense_heads;
DELETE FROM public.income_heads;
DELETE FROM public.other_heads;
DELETE FROM public.accounts;
DELETE FROM public.payments;
DELETE FROM public.bills;
DELETE FROM public.customers;
DELETE FROM public.packages;
DELETE FROM public.mikrotik_routers;
DELETE FROM public.olts;
DELETE FROM public.onus;
DELETE FROM public.employee_education;
DELETE FROM public.employee_experience;
DELETE FROM public.employee_emergency_contacts;
DELETE FROM public.employee_provident_fund;
DELETE FROM public.employee_salary_structure;
DELETE FROM public.employee_savings_fund;
DELETE FROM public.attendance;
DELETE FROM public.salary_sheets;
DELETE FROM public.loans;
DELETE FROM public.employees;
DELETE FROM public.designations;
DELETE FROM public.daily_reports;
DELETE FROM public.audit_logs;
DELETE FROM public.backup_logs;
DELETE FROM public.admin_login_logs;
DELETE FROM public.admin_sessions;
DELETE FROM public.ticket_replies;
DELETE FROM public.support_tickets;
DELETE FROM public.payment_gateways;
DELETE FROM public.general_settings;
DELETE FROM public.system_settings;
DELETE FROM public.sms_templates;
DELETE FROM public.sms_settings;

-- Re-seed general settings
INSERT INTO public.general_settings (site_name, primary_color) VALUES ('Smart ISP', '#3B82F6');

-- Re-seed SMS settings
INSERT INTO public.sms_settings (sms_on_bill_generate, sms_on_payment, sms_on_registration, sms_on_suspension) VALUES (true, true, true, true);

-- Re-seed default packages
INSERT INTO public.packages (name, speed, monthly_price, download_speed, upload_speed) VALUES
  ('Basic 10Mbps', '10 Mbps', 500, 10, 10),
  ('Standard 20Mbps', '20 Mbps', 800, 20, 20),
  ('Premium 50Mbps', '50 Mbps', 1200, 50, 50),
  ('Ultra 100Mbps', '100 Mbps', 2000, 100, 100);

-- Re-seed Chart of Accounts
DO $$
DECLARE
  v_assets uuid; v_liab uuid; v_income uuid; v_exp uuid; v_equity uuid;
BEGIN
  INSERT INTO accounts (name, type, code, is_system, level) VALUES ('Assets','asset','1000',true,0) RETURNING id INTO v_assets;
  INSERT INTO accounts (name, type, code, is_system, level) VALUES ('Liabilities','liability','2000',true,0) RETURNING id INTO v_liab;
  INSERT INTO accounts (name, type, code, is_system, level) VALUES ('Income','income','4000',true,0) RETURNING id INTO v_income;
  INSERT INTO accounts (name, type, code, is_system, level) VALUES ('Expenses','expense','5000',true,0) RETURNING id INTO v_exp;
  INSERT INTO accounts (name, type, code, is_system, level) VALUES ('Equity','equity','3000',true,0) RETURNING id INTO v_equity;
  INSERT INTO accounts (name, type, code, parent_id, level, is_system) VALUES
    ('Cash','asset','1001',v_assets,1,true),('Bank Account','asset','1002',v_assets,1,true),
    ('bKash','asset','1003',v_assets,1,true),('Nagad','asset','1004',v_assets,1,true),
    ('Accounts Receivable','asset','1100',v_assets,1,true),('Inventory','asset','1200',v_assets,1,true),
    ('Accounts Payable','liability','2001',v_liab,1,true),
    ('ISP Billing Revenue','income','4001',v_income,1,true),('Product Sales','income','4002',v_income,1,true),
    ('Cost of Goods Sold','expense','5001',v_exp,1,true),('Salary Expense','expense','5002',v_exp,1,false),
    ('Utility Expense','expense','5003',v_exp,1,false),('Office Expense','expense','5004',v_exp,1,false),
    ('Owner Equity','equity','3001',v_equity,1,false),('Retained Earnings','equity','3002',v_equity,1,false);
END $$;

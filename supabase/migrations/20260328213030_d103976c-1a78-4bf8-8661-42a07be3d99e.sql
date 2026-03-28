-- Clear all transactional and master data, preserve: profiles, user_roles, custom_roles, role_permissions, permissions

-- Child tables first (FK dependencies)
TRUNCATE TABLE ticket_replies CASCADE;
TRUNCATE TABLE support_tickets CASCADE;
TRUNCATE TABLE customer_sessions CASCADE;
TRUNCATE TABLE customer_ledger CASCADE;
TRUNCATE TABLE reminder_logs CASCADE;
TRUNCATE TABLE sms_logs CASCADE;
TRUNCATE TABLE merchant_payments CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE bills CASCADE;
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE purchase_items CASCADE;
TRUNCATE TABLE supplier_payments CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE onus CASCADE;
TRUNCATE TABLE olts CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE packages CASCADE;
TRUNCATE TABLE mikrotik_routers CASCADE;
TRUNCATE TABLE zones CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE suppliers CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE expense_heads CASCADE;
TRUNCATE TABLE income_heads CASCADE;
TRUNCATE TABLE other_heads CASCADE;
TRUNCATE TABLE daily_reports CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE admin_login_logs CASCADE;
TRUNCATE TABLE admin_sessions CASCADE;
TRUNCATE TABLE backup_logs CASCADE;
TRUNCATE TABLE attendance CASCADE;
TRUNCATE TABLE salary_sheets CASCADE;
TRUNCATE TABLE loans CASCADE;
TRUNCATE TABLE employee_savings_fund CASCADE;
TRUNCATE TABLE employee_provident_fund CASCADE;
TRUNCATE TABLE employee_salary_structure CASCADE;
TRUNCATE TABLE employee_experience CASCADE;
TRUNCATE TABLE employee_emergency_contacts CASCADE;
TRUNCATE TABLE employee_education CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE designations CASCADE;
TRUNCATE TABLE payment_gateways CASCADE;
TRUNCATE TABLE sms_templates CASCADE;
TRUNCATE TABLE sms_settings CASCADE;
TRUNCATE TABLE system_settings CASCADE;
TRUNCATE TABLE general_settings CASCADE;

-- Re-seed default general_settings
INSERT INTO general_settings (site_name, primary_color) VALUES ('Smart ISP', '#2563eb');

-- Re-seed default sms_settings
INSERT INTO sms_settings (sender_id, sms_on_bill_generate, sms_on_payment, sms_on_registration, sms_on_suspension) 
VALUES ('SmartISP', true, true, true, true);

-- Re-seed default Chart of Accounts
INSERT INTO accounts (code, name, type, level, is_system, balance) VALUES
('1000', 'Assets', 'asset', 0, true, 0),
('1100', 'Current Assets', 'asset', 1, true, 0),
('1101', 'Cash in Hand', 'asset', 2, true, 0),
('1102', 'Bank Account', 'asset', 2, true, 0),
('1103', 'bKash', 'asset', 2, true, 0),
('1104', 'Nagad', 'asset', 2, true, 0),
('1200', 'Accounts Receivable', 'asset', 2, true, 0),
('2000', 'Liabilities', 'liability', 0, true, 0),
('2100', 'Accounts Payable', 'liability', 1, true, 0),
('3000', 'Equity', 'equity', 0, true, 0),
('3100', 'Owner Equity', 'equity', 1, true, 0),
('4000', 'Income', 'income', 0, true, 0),
('4001', 'Service Income', 'income', 1, true, 0),
('4100', 'Sales Income', 'income', 1, true, 0),
('5000', 'Expenses', 'expense', 0, true, 0),
('5100', 'Cost of Goods Sold', 'expense', 1, true, 0),
('5200', 'Salary Expense', 'expense', 1, true, 0),
('5201', 'Utility Expense', 'expense', 1, true, 0),
('5202', 'Rent Expense', 'expense', 1, true, 0),
('5203', 'Maintenance Expense', 'expense', 1, true, 0),
('5204', 'Transport Expense', 'expense', 1, true, 0),
('5205', 'Internet Expense', 'expense', 1, true, 0),
('5206', 'Office Expense', 'expense', 1, true, 0),
('5299', 'Other Expense', 'expense', 1, true, 0);
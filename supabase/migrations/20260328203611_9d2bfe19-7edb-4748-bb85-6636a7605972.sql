-- Reset all transactional data while preserving admin users, roles, and permissions

-- Child/dependent tables first
DELETE FROM ticket_replies;
DELETE FROM support_tickets;
DELETE FROM reminder_logs;
DELETE FROM sms_logs;
DELETE FROM customer_ledger;
DELETE FROM customer_sessions;
DELETE FROM merchant_payments;
DELETE FROM payments;
DELETE FROM bills;
DELETE FROM admin_login_logs;
DELETE FROM audit_logs;
DELETE FROM backup_logs;
DELETE FROM daily_reports;

-- ONU before customers
DELETE FROM onus;
DELETE FROM customers;

-- HR related
DELETE FROM salary_sheets;
DELETE FROM attendance;
DELETE FROM loans;
DELETE FROM employee_provident_fund;
DELETE FROM employee_savings_fund;
DELETE FROM employee_salary_structure;
DELETE FROM employee_education;
DELETE FROM employee_experience;
DELETE FROM employee_emergency_contacts;
DELETE FROM employees;
DELETE FROM designations;

-- Accounting / Inventory
DELETE FROM sale_items;
DELETE FROM sales;
DELETE FROM purchase_items;
DELETE FROM purchases;
DELETE FROM supplier_payments;
DELETE FROM suppliers;
DELETE FROM expenses;
DELETE FROM transactions;
DELETE FROM accounts;
DELETE FROM products;
DELETE FROM income_heads;
DELETE FROM expense_heads;
DELETE FROM other_heads;

-- Settings (will be re-seeded)
DELETE FROM sms_templates;
DELETE FROM payment_gateways;
DELETE FROM packages;
DELETE FROM mikrotik_routers;
DELETE FROM olts;

-- Keep: profiles, user_roles, custom_roles, role_permissions, permissions
-- Keep: general_settings, sms_settings, system_settings

-- Re-seed default packages
INSERT INTO packages (name, speed, monthly_price, download_speed, upload_speed, is_active) VALUES
  ('Basic 10 Mbps', '10 Mbps', 500, 10, 10, true),
  ('Standard 20 Mbps', '20 Mbps', 800, 20, 20, true),
  ('Premium 50 Mbps', '50 Mbps', 1200, 50, 50, true),
  ('Ultra 100 Mbps', '100 Mbps', 2000, 100, 100, true);

-- Re-seed default Chart of Accounts
INSERT INTO accounts (name, type, code, level, is_system, is_active) VALUES
  ('Assets', 'asset', '1000', 0, true, true),
  ('Cash in Hand', 'asset', '1001', 1, true, true),
  ('Bank Account', 'asset', '1002', 1, true, true),
  ('Accounts Receivable', 'asset', '1003', 1, true, true),
  ('Liabilities', 'liability', '2000', 0, true, true),
  ('Accounts Payable', 'liability', '2001', 1, true, true),
  ('Equity', 'equity', '3000', 0, true, true),
  ('Owner Equity', 'equity', '3001', 1, true, true),
  ('Income', 'income', '4000', 0, true, true),
  ('Internet Service Revenue', 'income', '4001', 1, true, true),
  ('Installation Revenue', 'income', '4002', 1, true, true),
  ('Expenses', 'expense', '5000', 0, true, true),
  ('Salary Expense', 'expense', '5001', 1, true, true),
  ('Office Expense', 'expense', '5002', 1, true, true),
  ('Internet Bandwidth', 'expense', '5003', 1, true, true);

-- Clean up existing accounts and transactions for fresh start
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE accounts CASCADE;

-- ══════════════════════════════════════════════════════════
-- PROPER CHART OF ACCOUNTS WITH HIERARCHY (parent_id)
-- Standard ISP/Business Double-Entry Accounting Structure
-- ══════════════════════════════════════════════════════════

-- ═══ 1. ASSETS (1000-1999) ═══
INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active, balance) VALUES
-- Root
('a1000000-0000-0000-0000-000000000001', '1000', 'Assets', 'asset', 0, NULL, true, true, 0);

INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active, balance) VALUES
-- Current Assets
('a1100000-0000-0000-0000-000000000001', '1100', 'Current Assets', 'asset', 1, 'a1000000-0000-0000-0000-000000000001', true, true, 0),
('a1101000-0000-0000-0000-000000000001', '1101', 'Cash in Hand', 'asset', 2, 'a1100000-0000-0000-0000-000000000001', true, true, 0),
('a1102000-0000-0000-0000-000000000001', '1102', 'Bank Account', 'asset', 2, 'a1100000-0000-0000-0000-000000000001', true, true, 0),
('a1103000-0000-0000-0000-000000000001', '1103', 'bKash', 'asset', 2, 'a1100000-0000-0000-0000-000000000001', true, true, 0),
('a1104000-0000-0000-0000-000000000001', '1104', 'Nagad', 'asset', 2, 'a1100000-0000-0000-0000-000000000001', true, true, 0),
('a1200000-0000-0000-0000-000000000001', '1200', 'Accounts Receivable', 'asset', 2, 'a1100000-0000-0000-0000-000000000001', true, true, 0),
('a1300000-0000-0000-0000-000000000001', '1300', 'Inventory', 'asset', 2, 'a1100000-0000-0000-0000-000000000001', true, true, 0),
-- Fixed Assets
('a1500000-0000-0000-0000-000000000001', '1500', 'Fixed Assets', 'asset', 1, 'a1000000-0000-0000-0000-000000000001', true, true, 0),
('a1501000-0000-0000-0000-000000000001', '1501', 'Networking Equipment', 'asset', 2, 'a1500000-0000-0000-0000-000000000001', true, true, 0),
('a1502000-0000-0000-0000-000000000001', '1502', 'Furniture & Fixtures', 'asset', 2, 'a1500000-0000-0000-0000-000000000001', true, true, 0),
('a1503000-0000-0000-0000-000000000001', '1503', 'Vehicle', 'asset', 2, 'a1500000-0000-0000-0000-000000000001', true, true, 0);

-- ═══ 2. LIABILITIES (2000-2999) ═══
INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active, balance) VALUES
('a2000000-0000-0000-0000-000000000001', '2000', 'Liabilities', 'liability', 0, NULL, true, true, 0),
('a2100000-0000-0000-0000-000000000001', '2100', 'Current Liabilities', 'liability', 1, 'a2000000-0000-0000-0000-000000000001', true, true, 0),
('a2101000-0000-0000-0000-000000000001', '2101', 'Accounts Payable', 'liability', 2, 'a2100000-0000-0000-0000-000000000001', true, true, 0),
('a2102000-0000-0000-0000-000000000001', '2102', 'Advance Received', 'liability', 2, 'a2100000-0000-0000-0000-000000000001', true, true, 0),
('a2103000-0000-0000-0000-000000000001', '2103', 'Tax Payable', 'liability', 2, 'a2100000-0000-0000-0000-000000000001', true, true, 0),
('a2200000-0000-0000-0000-000000000001', '2200', 'Long Term Liabilities', 'liability', 1, 'a2000000-0000-0000-0000-000000000001', true, true, 0),
('a2201000-0000-0000-0000-000000000001', '2201', 'Loan Payable', 'liability', 2, 'a2200000-0000-0000-0000-000000000001', true, true, 0);

-- ═══ 3. EQUITY (3000-3999) ═══
INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active, balance) VALUES
('a3000000-0000-0000-0000-000000000001', '3000', 'Equity', 'equity', 0, NULL, true, true, 0),
('a3100000-0000-0000-0000-000000000001', '3100', 'Owner Equity', 'equity', 1, 'a3000000-0000-0000-0000-000000000001', true, true, 0),
('a3200000-0000-0000-0000-000000000001', '3200', 'Retained Earnings', 'equity', 1, 'a3000000-0000-0000-0000-000000000001', true, true, 0),
('a3300000-0000-0000-0000-000000000001', '3300', 'Owner Drawing', 'equity', 1, 'a3000000-0000-0000-0000-000000000001', true, true, 0);

-- ═══ 4. INCOME (4000-4999) ═══
INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active, balance) VALUES
('a4000000-0000-0000-0000-000000000001', '4000', 'Income', 'income', 0, NULL, true, true, 0),
('a4100000-0000-0000-0000-000000000001', '4100', 'Sales Income', 'income', 1, 'a4000000-0000-0000-0000-000000000001', true, true, 0),
('a4200000-0000-0000-0000-000000000001', '4200', 'Service Income', 'income', 1, 'a4000000-0000-0000-0000-000000000001', true, true, 0),
('a4201000-0000-0000-0000-000000000001', '4201', 'Internet Service Revenue', 'income', 2, 'a4200000-0000-0000-0000-000000000001', true, true, 0),
('a4202000-0000-0000-0000-000000000001', '4202', 'Installation Revenue', 'income', 2, 'a4200000-0000-0000-0000-000000000001', true, true, 0),
('a4300000-0000-0000-0000-000000000001', '4300', 'Other Income', 'income', 1, 'a4000000-0000-0000-0000-000000000001', true, true, 0);

-- ═══ 5. EXPENSES (5000-5999) ═══
INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active, balance) VALUES
('a5000000-0000-0000-0000-000000000001', '5000', 'Expenses', 'expense', 0, NULL, true, true, 0),
('a5100000-0000-0000-0000-000000000001', '5100', 'Cost of Goods Sold', 'expense', 1, 'a5000000-0000-0000-0000-000000000001', true, true, 0),
('a5200000-0000-0000-0000-000000000001', '5200', 'Operating Expenses', 'expense', 1, 'a5000000-0000-0000-0000-000000000001', true, true, 0),
('a5201000-0000-0000-0000-000000000001', '5201', 'Salary Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5202000-0000-0000-0000-000000000001', '5202', 'Utility Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5203000-0000-0000-0000-000000000001', '5203', 'Rent Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5204000-0000-0000-0000-000000000001', '5204', 'Maintenance Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5205000-0000-0000-0000-000000000001', '5205', 'Transport Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5206000-0000-0000-0000-000000000001', '5206', 'Internet Bandwidth', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5207000-0000-0000-0000-000000000001', '5207', 'Office Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5208000-0000-0000-0000-000000000001', '5208', 'Depreciation', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0),
('a5299000-0000-0000-0000-000000000001', '5299', 'Other Expense', 'expense', 2, 'a5200000-0000-0000-0000-000000000001', true, true, 0);

-- ═══ Auto-set default ledger settings ═══
INSERT INTO system_settings (setting_key, setting_value) VALUES
('sales_income_account', 'a4100000-0000-0000-0000-000000000001'),
('sales_cash_account', 'a1101000-0000-0000-0000-000000000001'),
('purchase_expense_account', 'a5100000-0000-0000-0000-000000000001'),
('purchase_cash_account', 'a1101000-0000-0000-0000-000000000001'),
('service_income_account', 'a4201000-0000-0000-0000-000000000001'),
('expense_cash_account', 'a1101000-0000-0000-0000-000000000001')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now();

-- Seed comprehensive ISP Chart of Accounts
-- Assets (1000)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status) VALUES
  ('Assets', 'asset', '1000', NULL, 0, 'All asset accounts', 'active');

WITH p AS (SELECT id FROM accounts WHERE code='1000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Current Assets', 'asset', '1100', p.id, 0, 'Short-term assets', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='1100' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'asset', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Cash in Hand','1101','Physical cash'),('Bank Account','1102','Bank deposits'),('Mobile Banking (bKash/Nagad)','1103','Mobile wallet balance')) AS t(n,c,d);

WITH p AS (SELECT id FROM accounts WHERE code='1000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Receivables', 'asset', '1200', p.id, 0, 'Money owed to us', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='1200' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'asset', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Customer Receivable','1201','Outstanding customer bills'),('Other Receivable','1202','Other receivables'),('Advance Payment','1203','Advance payments made')) AS t(n,c,d);

WITH p AS (SELECT id FROM accounts WHERE code='1000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Fixed Assets', 'asset', '1300', p.id, 0, 'Long-term assets', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='1300' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'asset', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Network Equipment','1301','Routers, OLTs, ONUs, cables'),('Office Equipment','1302','Computers, furniture')) AS t(n,c,d);

-- Liabilities (2000)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status) VALUES
  ('Liabilities', 'liability', '2000', NULL, 0, 'All liability accounts', 'active');

WITH p AS (SELECT id FROM accounts WHERE code='2000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Current Liabilities', 'liability', '2100', p.id, 0, 'Short-term liabilities', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='2100' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'liability', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Accounts Payable','2101','Supplier dues'),('Salary Payable','2102','Employee salary dues')) AS t(n,c,d);

WITH p AS (SELECT id FROM accounts WHERE code='2000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Long-term Liabilities', 'liability', '2200', p.id, 0, 'Long-term debts', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='2200' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'liability', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Bank Loan','2201','Bank loan balance'),('Other Loan','2202','Other loans')) AS t(n,c,d);

-- Equity (3000)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status) VALUES
  ('Equity', 'equity', '3000', NULL, 0, 'All equity accounts', 'active');

WITH p AS (SELECT id FROM accounts WHERE code='3000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'equity', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Owner Capital','3100','Owner investment'),('Retained Earnings','3200','Accumulated profit/loss')) AS t(n,c,d);

-- Income (4000)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status) VALUES
  ('Income', 'income', '4000', NULL, 0, 'All income accounts', 'active');

WITH p AS (SELECT id FROM accounts WHERE code='4000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Service Income', 'income', '4100', p.id, 0, 'ISP service revenue', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='4100' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'income', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Monthly Subscription','4101','Monthly bill payments'),('Connection Fee','4102','New connection charges'),('Reconnection Fee','4103','Reconnection charges')) AS t(n,c,d);

WITH p AS (SELECT id FROM accounts WHERE code='4000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Other Income', 'income', '4200', p.id, 0, 'Non-service income', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='4200' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'income', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Equipment Sales','4201','Selling equipment'),('Interest Income','4202','Bank interest')) AS t(n,c,d);

-- Expenses (5000)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status) VALUES
  ('Expenses', 'expense', '5000', NULL, 0, 'All expense accounts', 'active');

WITH p AS (SELECT id FROM accounts WHERE code='5000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Bandwidth & Network', 'expense', '5100', p.id, 0, 'Network operation costs', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='5100' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'expense', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Bandwidth Purchase','5101','IIG/ISP bandwidth cost'),('Colocation & Hosting','5102','Server and rack rent'),('Network Maintenance','5103','Repair and maintenance')) AS t(n,c,d);

WITH p AS (SELECT id FROM accounts WHERE code='5000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Operating Expenses', 'expense', '5200', p.id, 0, 'Day-to-day expenses', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='5200' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'expense', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Salary & Wages','5201','Employee salaries'),('Office Rent','5202','Office rent'),('Utilities','5203','Electricity, water'),('Transportation','5204','Travel costs')) AS t(n,c,d);

WITH p AS (SELECT id FROM accounts WHERE code='5000' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT 'Administrative Expenses', 'expense', '5300', p.id, 0, 'Admin costs', 'active' FROM p;

WITH p AS (SELECT id FROM accounts WHERE code='5300' LIMIT 1)
INSERT INTO accounts (name, type, code, parent_id, balance, description, status)
SELECT n, 'expense', c, p.id, 0, d, 'active' FROM p,
(VALUES ('Bank Charges','5301','Bank fees'),('SMS & Communication','5302','SMS gateway costs'),('BTRC License Fee','5303','Regulatory fees'),('Marketing','5304','Advertising'),('Depreciation','5305','Asset depreciation')) AS t(n,c,d);
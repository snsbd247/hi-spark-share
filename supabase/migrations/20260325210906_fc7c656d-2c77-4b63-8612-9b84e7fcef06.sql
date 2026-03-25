
-- FULL DATABASE RESET AND DEMO SEED (v2)

TRUNCATE TABLE 
  ticket_replies, support_tickets, 
  reminder_logs, sms_logs, sms_templates, sms_settings,
  customer_ledger, customer_sessions,
  merchant_payments, 
  payments, bills, 
  purchase_items,
  supplier_payments, purchases,
  transactions,
  products,
  attendance, salary_sheets, loans, employees, designations,
  onus, olts, mikrotik_routers,
  backup_logs, audit_logs, admin_login_logs, admin_sessions,
  role_permissions, user_roles, permissions, custom_roles,
  accounts, income_heads, expense_heads, other_heads,
  payment_gateways,
  customers, packages, zones,
  profiles, general_settings, system_settings,
  suppliers
CASCADE;

INSERT INTO general_settings (site_name, email, mobile, address, primary_color) VALUES ('Smart ISP', 'info@smartisp.com', '01700000000', 'Dhaka, Bangladesh', '#2563eb');

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('module_customers','true'),('module_billing','true'),('module_payments','true'),('module_merchant_payments','true'),
  ('module_tickets','true'),('module_sms','true'),('module_accounting','true'),('module_hr','true'),
  ('module_supplier','true'),('module_reports','true'),('module_users','true'),('module_roles','true'),('module_settings','true');

INSERT INTO permissions (module, action, description) VALUES
  ('customers','view','View'),('customers','create','Create'),('customers','edit','Edit'),('customers','delete','Delete'),
  ('billing','view','View'),('billing','create','Create'),('billing','edit','Edit'),('billing','delete','Delete'),
  ('payments','view','View'),('payments','create','Create'),('payments','edit','Edit'),('payments','delete','Delete'),
  ('merchant_payments','view','View'),('merchant_payments','create','Create'),('merchant_payments','edit','Edit'),('merchant_payments','delete','Delete'),
  ('tickets','view','View'),('tickets','create','Create'),('tickets','edit','Edit'),('tickets','delete','Delete'),
  ('sms','view','View'),('sms','create','Create'),('sms','edit','Edit'),('sms','delete','Delete'),
  ('accounting','view','View'),('accounting','create','Create'),('accounting','edit','Edit'),('accounting','delete','Delete'),
  ('hr','view','View'),('hr','create','Create'),('hr','edit','Edit'),('hr','delete','Delete'),
  ('supplier','view','View'),('supplier','create','Create'),('supplier','edit','Edit'),('supplier','delete','Delete'),
  ('settings','view','View'),('settings','create','Create'),('settings','edit','Edit'),('settings','delete','Delete'),
  ('users','view','View'),('users','create','Create'),('users','edit','Edit'),('users','delete','Delete'),
  ('roles','view','View'),('roles','create','Create'),('roles','edit','Edit'),('roles','delete','Delete'),
  ('reports','view','View'),('reports','create','Create'),('reports','edit','Edit'),('reports','delete','Delete');

INSERT INTO custom_roles (id, name, db_role, description, is_system) VALUES
  ('a0000001-0000-0000-0000-000000000001','Super Admin','super_admin','Full system access',true),
  ('a0000001-0000-0000-0000-000000000002','Admin','admin','Administrative access',true),
  ('a0000001-0000-0000-0000-000000000003','Manager','manager','Branch manager',false),
  ('a0000001-0000-0000-0000-000000000004','Operator','operator','Daily operations',false),
  ('a0000001-0000-0000-0000-000000000005','Technician','technician','Field tech',false),
  ('a0000001-0000-0000-0000-000000000006','Accountant','accountant','Finance',false),
  ('a0000001-0000-0000-0000-000000000007','Staff','staff','General staff',false);

INSERT INTO role_permissions (role_id, permission_id) SELECT 'a0000001-0000-0000-0000-000000000002', id FROM permissions;
INSERT INTO role_permissions (role_id, permission_id) SELECT 'a0000001-0000-0000-0000-000000000003', id FROM permissions WHERE module IN ('customers','billing','payments','merchant_payments','tickets','sms','reports');
INSERT INTO role_permissions (role_id, permission_id) SELECT 'a0000001-0000-0000-0000-000000000004', id FROM permissions WHERE module IN ('customers','billing','payments','tickets') AND action IN ('view','create','edit');
INSERT INTO role_permissions (role_id, permission_id) SELECT 'a0000001-0000-0000-0000-000000000005', id FROM permissions WHERE (module='customers' AND action='view') OR (module='tickets' AND action IN ('view','create','edit'));
INSERT INTO role_permissions (role_id, permission_id) SELECT 'a0000001-0000-0000-0000-000000000006', id FROM permissions WHERE module IN ('accounting','payments','billing','merchant_payments','hr','supplier','reports');
INSERT INTO role_permissions (role_id, permission_id) SELECT 'a0000001-0000-0000-0000-000000000007', id FROM permissions WHERE (module IN ('customers','billing','payments') AND action='view') OR (module='tickets' AND action IN ('view','create'));

INSERT INTO profiles (id, full_name, username, email, mobile, staff_id, password_hash, status) VALUES
  ('b0000001-0000-0000-0000-000000000001','Super Admin','superadmin','superadmin@smartisp.com','01700000001','SA-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active'),
  ('b0000001-0000-0000-0000-000000000002','Admin User','admin','admin@smartisp.com','01700000002','AD-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active'),
  ('b0000001-0000-0000-0000-000000000003','Manager User','manager','manager@smartisp.com','01700000003','MG-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active'),
  ('b0000001-0000-0000-0000-000000000004','Operator User','operator','operator@smartisp.com','01700000004','OP-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active'),
  ('b0000001-0000-0000-0000-000000000005','Technician User','technician','tech@smartisp.com','01700000005','TC-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active'),
  ('b0000001-0000-0000-0000-000000000006','Accountant User','accountant','accounts@smartisp.com','01700000006','AC-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active'),
  ('b0000001-0000-0000-0000-000000000007','Staff User','staff','staff@smartisp.com','01700000007','ST-001','$2a$10$VQD/I8mMGaHbXMVMi3pq.OIlGaERwgKkqHrJ2D7fqB2jQmj3k7AHe','active');

INSERT INTO user_roles (user_id, role, custom_role_id) VALUES
  ('b0000001-0000-0000-0000-000000000001','super_admin','a0000001-0000-0000-0000-000000000001'),
  ('b0000001-0000-0000-0000-000000000002','admin','a0000001-0000-0000-0000-000000000002'),
  ('b0000001-0000-0000-0000-000000000003','manager','a0000001-0000-0000-0000-000000000003'),
  ('b0000001-0000-0000-0000-000000000004','operator','a0000001-0000-0000-0000-000000000004'),
  ('b0000001-0000-0000-0000-000000000005','technician','a0000001-0000-0000-0000-000000000005'),
  ('b0000001-0000-0000-0000-000000000006','accountant','a0000001-0000-0000-0000-000000000006'),
  ('b0000001-0000-0000-0000-000000000007','staff','a0000001-0000-0000-0000-000000000007');

-- CHART OF ACCOUNTS
INSERT INTO accounts (id, code, name, type, level, parent_id, is_system, is_active) VALUES
  ('c0000001-0000-0000-0000-000000000001','1000','Assets','asset',0,NULL,true,true),
  ('c0000001-0000-0000-0000-000000000010','1100','Current Assets','asset',1,'c0000001-0000-0000-0000-000000000001',true,true),
  ('c0000001-0000-0000-0000-000000000011','1101','Cash in Hand','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000012','1102','Cash at Bank','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000013','1103','bKash Account','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000014','1104','Nagad Account','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000015','1105','Accounts Receivable','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000016','1106','Advance to Suppliers','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000017','1107','Inventory - Networking Equipment','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000018','1108','Petty Cash','asset',2,'c0000001-0000-0000-0000-000000000010',true,true),
  ('c0000001-0000-0000-0000-000000000020','1200','Fixed Assets','asset',1,'c0000001-0000-0000-0000-000000000001',true,true),
  ('c0000001-0000-0000-0000-000000000021','1201','Office Equipment','asset',2,'c0000001-0000-0000-0000-000000000020',true,true),
  ('c0000001-0000-0000-0000-000000000022','1202','Network Infrastructure','asset',2,'c0000001-0000-0000-0000-000000000020',true,true),
  ('c0000001-0000-0000-0000-000000000023','1203','Fiber Optic Cables','asset',2,'c0000001-0000-0000-0000-000000000020',true,true),
  ('c0000001-0000-0000-0000-000000000024','1204','Vehicles','asset',2,'c0000001-0000-0000-0000-000000000020',true,true),
  ('c0000001-0000-0000-0000-000000000025','1205','Furniture and Fixtures','asset',2,'c0000001-0000-0000-0000-000000000020',true,true),
  ('c0000001-0000-0000-0000-000000000026','1206','Accumulated Depreciation','asset',2,'c0000001-0000-0000-0000-000000000020',true,true),
  ('c0000001-0000-0000-0000-000000000002','2000','Liabilities','liability',0,NULL,true,true),
  ('c0000001-0000-0000-0000-000000000030','2100','Current Liabilities','liability',1,'c0000001-0000-0000-0000-000000000002',true,true),
  ('c0000001-0000-0000-0000-000000000031','2101','Accounts Payable','liability',2,'c0000001-0000-0000-0000-000000000030',true,true),
  ('c0000001-0000-0000-0000-000000000032','2102','Salary Payable','liability',2,'c0000001-0000-0000-0000-000000000030',true,true),
  ('c0000001-0000-0000-0000-000000000033','2103','Tax Payable (VAT/AIT)','liability',2,'c0000001-0000-0000-0000-000000000030',true,true),
  ('c0000001-0000-0000-0000-000000000034','2104','Advance from Customers','liability',2,'c0000001-0000-0000-0000-000000000030',true,true),
  ('c0000001-0000-0000-0000-000000000035','2105','Utility Bills Payable','liability',2,'c0000001-0000-0000-0000-000000000030',true,true),
  ('c0000001-0000-0000-0000-000000000040','2200','Long Term Liabilities','liability',1,'c0000001-0000-0000-0000-000000000002',true,true),
  ('c0000001-0000-0000-0000-000000000041','2201','Bank Loan','liability',2,'c0000001-0000-0000-0000-000000000040',true,true),
  ('c0000001-0000-0000-0000-000000000042','2202','Employee Loans Payable','liability',2,'c0000001-0000-0000-0000-000000000040',true,true),
  ('c0000001-0000-0000-0000-000000000003','3000','Equity','equity',0,NULL,true,true),
  ('c0000001-0000-0000-0000-000000000050','3100','Capital','equity',1,'c0000001-0000-0000-0000-000000000003',true,true),
  ('c0000001-0000-0000-0000-000000000051','3101','Owners Equity','equity',2,'c0000001-0000-0000-0000-000000000050',true,true),
  ('c0000001-0000-0000-0000-000000000052','3102','Retained Earnings','equity',2,'c0000001-0000-0000-0000-000000000050',true,true),
  ('c0000001-0000-0000-0000-000000000053','3103','Owners Drawings','equity',2,'c0000001-0000-0000-0000-000000000050',true,true),
  ('c0000001-0000-0000-0000-000000000004','4000','Income','income',0,NULL,true,true),
  ('c0000001-0000-0000-0000-000000000060','4100','Operating Income','income',1,'c0000001-0000-0000-0000-000000000004',true,true),
  ('c0000001-0000-0000-0000-000000000061','4101','Internet Service Revenue','income',2,'c0000001-0000-0000-0000-000000000060',true,true),
  ('c0000001-0000-0000-0000-000000000062','4102','Installation and Connectivity Fee','income',2,'c0000001-0000-0000-0000-000000000060',true,true),
  ('c0000001-0000-0000-0000-000000000063','4103','Equipment Sales Revenue','income',2,'c0000001-0000-0000-0000-000000000060',true,true),
  ('c0000001-0000-0000-0000-000000000064','4104','Late Payment Fee','income',2,'c0000001-0000-0000-0000-000000000060',true,true),
  ('c0000001-0000-0000-0000-000000000065','4105','Reconnection Fee','income',2,'c0000001-0000-0000-0000-000000000060',true,true),
  ('c0000001-0000-0000-0000-000000000070','4200','Other Income','income',1,'c0000001-0000-0000-0000-000000000004',true,true),
  ('c0000001-0000-0000-0000-000000000071','4201','Interest Income','income',2,'c0000001-0000-0000-0000-000000000070',true,true),
  ('c0000001-0000-0000-0000-000000000072','4202','Miscellaneous Income','income',2,'c0000001-0000-0000-0000-000000000070',true,true),
  ('c0000001-0000-0000-0000-000000000005','5000','Expenses','expense',0,NULL,true,true),
  ('c0000001-0000-0000-0000-000000000080','5100','Operating Expenses','expense',1,'c0000001-0000-0000-0000-000000000005',true,true),
  ('c0000001-0000-0000-0000-000000000081','5101','Bandwidth Cost (IIG/NTTN)','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000082','5102','Salary and Wages','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000083','5103','Office Rent','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000084','5104','Electricity and Utility','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000085','5105','Transport and Fuel','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000086','5106','Maintenance and Repair','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000087','5107','Depreciation Expense','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000088','5108','Telephone and Internet','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000089','5109','Stationery and Office Supplies','expense',2,'c0000001-0000-0000-0000-000000000080',true,true),
  ('c0000001-0000-0000-0000-000000000090','5200','Administrative Expenses','expense',1,'c0000001-0000-0000-0000-000000000005',true,true),
  ('c0000001-0000-0000-0000-000000000091','5201','BTRC License Fee','expense',2,'c0000001-0000-0000-0000-000000000090',true,true),
  ('c0000001-0000-0000-0000-000000000092','5202','Legal and Professional Fee','expense',2,'c0000001-0000-0000-0000-000000000090',true,true),
  ('c0000001-0000-0000-0000-000000000093','5203','Insurance Expense','expense',2,'c0000001-0000-0000-0000-000000000090',true,true),
  ('c0000001-0000-0000-0000-000000000094','5204','Marketing and Advertising','expense',2,'c0000001-0000-0000-0000-000000000090',true,true),
  ('c0000001-0000-0000-0000-000000000095','5205','Bank Charges','expense',2,'c0000001-0000-0000-0000-000000000090',true,true),
  ('c0000001-0000-0000-0000-000000000096','5206','Miscellaneous Expense','expense',2,'c0000001-0000-0000-0000-000000000090',true,true);

-- PAYMENT GATEWAYS
INSERT INTO payment_gateways (gateway_name, environment, status, username, password, app_key, app_secret, base_url, merchant_number, receiving_account_id) VALUES
  ('bkash','sandbox','connected','sandboxTokenizedUser02','sandboxTokenizedUser02@12345','4f6o0cjiki2rfm34kfdadl1eqq','2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b','https://tokenized.sandbox.bka.sh/v1.2.0-beta','01770618567','c0000001-0000-0000-0000-000000000013'),
  ('nagad','sandbox','disconnected',NULL,NULL,NULL,NULL,'https://sandbox.nagad.com.bd','01700000000','c0000001-0000-0000-0000-000000000014');

-- ZONES and PACKAGES
INSERT INTO zones (id, area_name, address, status) VALUES
  ('d0000001-0000-0000-0000-000000000001','Mirpur','Mirpur-10, Dhaka','active'),
  ('d0000001-0000-0000-0000-000000000002','Uttara','Uttara Sector-7, Dhaka','active'),
  ('d0000001-0000-0000-0000-000000000003','Dhanmondi','Dhanmondi 27, Dhaka','active');

INSERT INTO packages (id, name, speed, download_speed, upload_speed, monthly_price, is_active) VALUES
  ('e0000001-0000-0000-0000-000000000001','Basic 10Mbps','10 Mbps',10,10,500,true),
  ('e0000001-0000-0000-0000-000000000002','Standard 20Mbps','20 Mbps',20,20,800,true),
  ('e0000001-0000-0000-0000-000000000003','Premium 50Mbps','50 Mbps',50,50,1200,true),
  ('e0000001-0000-0000-0000-000000000004','Ultra 100Mbps','100 Mbps',100,100,2000,true);

-- SMS
INSERT INTO sms_settings (sender_id, sms_on_registration, sms_on_bill_generate, sms_on_payment, sms_on_suspension) VALUES ('SmartISP',true,true,true,true);
INSERT INTO sms_templates (name, message) VALUES
  ('Bill Generate','Dear {name}, your bill for {month} is {amount} BDT. Please pay before {due_date}.'),
  ('Payment Received','Dear {name}, we received {amount} BDT payment for {month}. Thank you!'),
  ('Suspension Notice','Dear {name}, your connection has been suspended due to non-payment.');

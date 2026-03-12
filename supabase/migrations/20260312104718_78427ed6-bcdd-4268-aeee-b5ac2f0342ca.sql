-- Payments for Feb 2026
INSERT INTO payments (customer_id, bill_id, amount, month, payment_method, status, paid_at, tenant_id)
SELECT b.customer_id, b.id, b.amount, b.month, 'cash', 'completed', '2026-02-15'::timestamptz, b.tenant_id
FROM bills b WHERE b.status = 'paid' AND b.month = '2026-02' AND b.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city'));

-- Payments for Jan 2026
INSERT INTO payments (customer_id, bill_id, amount, month, payment_method, status, paid_at, tenant_id)
SELECT b.customer_id, b.id, b.amount, b.month, 'bkash', 'completed', '2026-01-12'::timestamptz, b.tenant_id
FROM bills b WHERE b.status = 'paid' AND b.month = '2026-01' AND b.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city'));

-- Merchant payments
INSERT INTO merchant_payments (transaction_id, sender_phone, amount, payment_date, reference, status, tenant_id) VALUES
  ('TXN20260301', '01712345678', 800, '2026-03-01'::timestamptz, 'ALPHA-001 March', 'unmatched', (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('TXN20260302', '01798765432', 500, '2026-03-02'::timestamptz, 'ALPHA-002 March', 'unmatched', (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('TXN20260303', '01611223344', 1400, '2026-03-03'::timestamptz, 'ALPHA-003 March', 'unmatched', (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('TXN20260304', '01411223344', 800, '2026-03-04'::timestamptz, 'FAST-001 March', 'unmatched', (SELECT id FROM tenants WHERE subdomain = 'fast')),
  ('TXN20260305', '01244556677', 800, '2026-03-05'::timestamptz, 'CITY-001 March', 'unmatched', (SELECT id FROM tenants WHERE subdomain = 'city'));

-- Ledger: bill entries
INSERT INTO customer_ledger (customer_id, type, description, debit, credit, balance, reference, date, tenant_id)
SELECT b.customer_id, 'bill', 'Monthly Bill - ' || b.month, b.amount, 0, b.amount, 'BILL-' || LEFT(b.id::text, 8), b.created_at, b.tenant_id
FROM bills b WHERE b.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city'));

-- Ledger: payment entries
INSERT INTO customer_ledger (customer_id, type, description, debit, credit, balance, reference, date, tenant_id)
SELECT p.customer_id, 'payment', 'Payment Received - ' || p.month, 0, p.amount, 0, 'PAY-' || LEFT(p.id::text, 8), p.paid_at, p.tenant_id
FROM payments p WHERE p.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city'));

-- SMS logs
INSERT INTO sms_logs (phone, message, sms_type, status, customer_id, tenant_id)
SELECT c.phone, 'Dear ' || c.name || ', your March 2026 bill of BDT ' || (c.monthly_bill - COALESCE(c.discount,0)) || ' is due.', 'bill_reminder', 'sent', c.id, c.tenant_id
FROM customers c WHERE c.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city')) LIMIT 5;

-- Reminder logs
INSERT INTO reminder_logs (phone, message, channel, status, customer_id, tenant_id)
SELECT c.phone, 'Reminder: Your bill is overdue. Service may be suspended.', 'sms', 'sent', c.id, c.tenant_id
FROM customers c WHERE c.connection_status = 'suspended' AND c.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city'));

-- Audit logs
INSERT INTO audit_logs (admin_id, admin_name, action, table_name, record_id, new_data, tenant_id) VALUES
  ('00000000-0000-0000-0000-000000000000', 'System Seed', 'INSERT', 'customers', 'ALPHA-001', '{"name":"Rahim Uddin"}'::jsonb, (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('00000000-0000-0000-0000-000000000000', 'System Seed', 'INSERT', 'customers', 'FAST-001', '{"name":"Mizanur Rahman"}'::jsonb, (SELECT id FROM tenants WHERE subdomain = 'fast')),
  ('00000000-0000-0000-0000-000000000000', 'System Seed', 'INSERT', 'customers', 'CITY-001', '{"name":"Habibur Rahman"}'::jsonb, (SELECT id FROM tenants WHERE subdomain = 'city')),
  ('00000000-0000-0000-0000-000000000000', 'System Seed', 'UPDATE', 'bills', 'FEB-2026', '{"action":"Bills generated"}'::jsonb, (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('00000000-0000-0000-0000-000000000000', 'System Seed', 'INSERT', 'payments', 'PAY-JAN', '{"action":"Payments recorded"}'::jsonb, (SELECT id FROM tenants WHERE subdomain = 'fast'));
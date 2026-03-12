-- Generate bills for March 2026 (current month - unpaid)
INSERT INTO bills (customer_id, month, amount, due_date, status, tenant_id)
SELECT c.id, '2026-03', c.monthly_bill - COALESCE(c.discount, 0), 
  CASE WHEN c.due_date_day <= 28 THEN ('2026-03-' || LPAD(c.due_date_day::text, 2, '0'))::date ELSE '2026-03-28'::date END,
  'unpaid', c.tenant_id
FROM customers c WHERE c.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city'));

-- Generate bills for February 2026 (paid)
INSERT INTO bills (customer_id, month, amount, due_date, status, paid_date, tenant_id)
SELECT c.id, '2026-02', c.monthly_bill - COALESCE(c.discount, 0),
  CASE WHEN c.due_date_day <= 28 THEN ('2026-02-' || LPAD(c.due_date_day::text, 2, '0'))::date ELSE '2026-02-28'::date END,
  'paid', '2026-02-15'::timestamptz, c.tenant_id
FROM customers c WHERE c.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city')) AND c.connection_status = 'active';

-- Generate bills for January 2026 (paid)
INSERT INTO bills (customer_id, month, amount, due_date, status, paid_date, tenant_id)
SELECT c.id, '2026-01', c.monthly_bill - COALESCE(c.discount, 0),
  CASE WHEN c.due_date_day <= 28 THEN ('2026-01-' || LPAD(c.due_date_day::text, 2, '0'))::date ELSE '2026-01-28'::date END,
  'paid', '2026-01-12'::timestamptz, c.tenant_id
FROM customers c WHERE c.tenant_id IN (SELECT id FROM tenants WHERE subdomain IN ('alpha','fast','city')) AND c.connection_status = 'active';
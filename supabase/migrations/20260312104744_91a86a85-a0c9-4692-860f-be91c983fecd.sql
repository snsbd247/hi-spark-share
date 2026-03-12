-- Support tickets (using LIMIT 1 to avoid ambiguity)
DO $$
DECLARE
  v_cust_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Ticket 1: ALPHA-001
  SELECT id, tenant_id INTO v_cust_id, v_tenant_id FROM customers WHERE customer_id = 'ALPHA-001' LIMIT 1;
  INSERT INTO support_tickets (customer_id, ticket_id, subject, category, priority, status, tenant_id)
  VALUES (v_cust_id, 'TKT-00001', 'Slow internet speed during evening', 'technical', 'high', 'open', v_tenant_id);
  
  -- Ticket 2: ALPHA-003
  SELECT id, tenant_id INTO v_cust_id, v_tenant_id FROM customers WHERE customer_id = 'ALPHA-003' LIMIT 1;
  INSERT INTO support_tickets (customer_id, ticket_id, subject, category, priority, status, tenant_id)
  VALUES (v_cust_id, 'TKT-00002', 'Billing amount incorrect for this month', 'billing', 'medium', 'open', v_tenant_id);

  -- Ticket 3: FAST-001
  SELECT id, tenant_id INTO v_cust_id, v_tenant_id FROM customers WHERE customer_id = 'FAST-001' LIMIT 1;
  INSERT INTO support_tickets (customer_id, ticket_id, subject, category, priority, status, tenant_id)
  VALUES (v_cust_id, 'TKT-00003', 'Connection dropping frequently', 'technical', 'high', 'open', v_tenant_id);

  -- Ticket 4: FAST-002
  SELECT id, tenant_id INTO v_cust_id, v_tenant_id FROM customers WHERE customer_id = 'FAST-002' LIMIT 1;
  INSERT INTO support_tickets (customer_id, ticket_id, subject, category, priority, status, tenant_id)
  VALUES (v_cust_id, 'TKT-00004', 'Request for package upgrade', 'general', 'low', 'resolved', v_tenant_id);

  -- Ticket 5: CITY-001
  SELECT id, tenant_id INTO v_cust_id, v_tenant_id FROM customers WHERE customer_id = 'CITY-001' LIMIT 1;
  INSERT INTO support_tickets (customer_id, ticket_id, subject, category, priority, status, tenant_id)
  VALUES (v_cust_id, 'TKT-00005', 'Router not working after power outage', 'technical', 'high', 'open', v_tenant_id);

  -- Ticket 6: CITY-002
  SELECT id, tenant_id INTO v_cust_id, v_tenant_id FROM customers WHERE customer_id = 'CITY-002' LIMIT 1;
  INSERT INTO support_tickets (customer_id, ticket_id, subject, category, priority, status, tenant_id)
  VALUES (v_cust_id, 'TKT-00006', 'Payment not reflected in bill', 'billing', 'medium', 'open', v_tenant_id);
END $$;

-- Ticket replies
INSERT INTO ticket_replies (ticket_id, message, sender_name, sender_type, tenant_id)
SELECT st.id, 'We are investigating the bandwidth issue. A technician will visit tomorrow.', 'Admin', 'admin', st.tenant_id
FROM support_tickets st WHERE st.ticket_id = 'TKT-00001';

INSERT INTO ticket_replies (ticket_id, message, sender_name, sender_type, tenant_id)
SELECT st.id, 'Please restart your router and check again.', 'Operator', 'admin', st.tenant_id
FROM support_tickets st WHERE st.ticket_id = 'TKT-00003';

INSERT INTO ticket_replies (ticket_id, message, sender_name, sender_type, tenant_id)
SELECT st.id, 'A replacement router has been dispatched. ETA: 24 hours.', 'Support', 'admin', st.tenant_id
FROM support_tickets st WHERE st.ticket_id = 'TKT-00005';
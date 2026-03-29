
DELETE FROM sms_logs WHERE customer_id IN (SELECT id FROM customers);
DELETE FROM reminder_logs WHERE customer_id IN (SELECT id FROM customers);
DELETE FROM admin_login_logs WHERE action = 'customer_login';
DELETE FROM customer_ledger;
DELETE FROM payments;
DELETE FROM bills;
DELETE FROM merchant_payments;
DELETE FROM ticket_replies WHERE ticket_id IN (SELECT id FROM support_tickets);
DELETE FROM support_tickets;
DELETE FROM customer_sessions;
DELETE FROM onus WHERE customer_id IN (SELECT id FROM customers);
DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales);
DELETE FROM sales;
DELETE FROM transactions WHERE description ILIKE '%customer%';
DELETE FROM customers;

-- Fix missing customer_ledger credit entries for existing payments
-- Find payments that don't have corresponding ledger credit entries and insert them
INSERT INTO customer_ledger (customer_id, date, type, description, debit, credit, balance, reference)
SELECT 
  p.customer_id,
  p.paid_at,
  'payment',
  'Payment Received (' || p.payment_method || ')',
  0,
  p.amount,
  COALESCE(
    (SELECT cl.balance FROM customer_ledger cl 
     WHERE cl.customer_id = p.customer_id 
     ORDER BY cl.created_at DESC LIMIT 1), 0
  ) - p.amount,
  CASE 
    WHEN p.transaction_id IS NOT NULL THEN 'TXN-' || p.transaction_id
    ELSE 'PAY-' || LEFT(p.id::text, 8)
  END
FROM payments p
WHERE p.status = 'completed'
AND NOT EXISTS (
  SELECT 1 FROM customer_ledger cl 
  WHERE cl.customer_id = p.customer_id 
  AND cl.type = 'payment' 
  AND cl.credit = p.amount
  AND cl.reference = CASE 
    WHEN p.transaction_id IS NOT NULL THEN 'TXN-' || p.transaction_id
    ELSE 'PAY-' || LEFT(p.id::text, 8)
  END
);
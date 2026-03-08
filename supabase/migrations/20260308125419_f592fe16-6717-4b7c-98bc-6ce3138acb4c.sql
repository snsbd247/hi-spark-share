
-- Insert a test package
INSERT INTO public.packages (name, speed, monthly_price, download_speed, upload_speed)
VALUES ('Basic 10Mbps', '10 Mbps', 500, 10, 10);

-- Insert a test customer with PPPoE credentials
INSERT INTO public.customers (customer_id, name, phone, area, monthly_bill, pppoe_username, pppoe_password, status, package_id)
VALUES (
  'ISP-00001',
  'Test Customer',
  '01700000000',
  'Mirpur',
  500,
  'testuser',
  'testpass123',
  'active',
  (SELECT id FROM public.packages WHERE name = 'Basic 10Mbps' LIMIT 1)
);

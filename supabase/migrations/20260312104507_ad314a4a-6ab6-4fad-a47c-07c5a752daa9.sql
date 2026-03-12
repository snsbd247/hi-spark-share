-- Insert 3 test tenants
INSERT INTO tenants (company_name, subdomain, contact_email, status, max_customers) VALUES
  ('AlphaNet ISP', 'alpha', 'admin@alphanet.com', 'active', 1000),
  ('FastFiber ISP', 'fast', 'admin@fastfiber.com', 'active', 500),
  ('CityLink ISP', 'city', 'admin@citylink.com', 'active', 750);

-- Insert packages for each tenant
INSERT INTO packages (name, speed, monthly_price, download_speed, upload_speed, is_active, tenant_id)
SELECT '10 Mbps Basic', '10 Mbps', 500, 10, 5, true, t.id FROM tenants t WHERE t.subdomain = 'alpha'
UNION ALL SELECT '20 Mbps Standard', '20 Mbps', 800, 20, 10, true, t.id FROM tenants t WHERE t.subdomain = 'alpha'
UNION ALL SELECT '50 Mbps Premium', '50 Mbps', 1500, 50, 25, true, t.id FROM tenants t WHERE t.subdomain = 'alpha'
UNION ALL SELECT '10 Mbps Starter', '10 Mbps', 500, 10, 5, true, t.id FROM tenants t WHERE t.subdomain = 'fast'
UNION ALL SELECT '20 Mbps Pro', '20 Mbps', 800, 20, 10, true, t.id FROM tenants t WHERE t.subdomain = 'fast'
UNION ALL SELECT '50 Mbps Ultra', '50 Mbps', 1500, 50, 25, true, t.id FROM tenants t WHERE t.subdomain = 'fast'
UNION ALL SELECT '10 Mbps Economy', '10 Mbps', 500, 10, 5, true, t.id FROM tenants t WHERE t.subdomain = 'city'
UNION ALL SELECT '20 Mbps Regular', '20 Mbps', 800, 20, 10, true, t.id FROM tenants t WHERE t.subdomain = 'city'
UNION ALL SELECT '50 Mbps Business', '50 Mbps', 1500, 50, 25, true, t.id FROM tenants t WHERE t.subdomain = 'city';

-- Insert zones
INSERT INTO zones (area_name, address, status, tenant_id)
SELECT 'Mirpur', 'Mirpur-10, Dhaka', 'active', t.id FROM tenants t WHERE t.subdomain = 'alpha'
UNION ALL SELECT 'Uttara', 'Sector-7, Uttara, Dhaka', 'active', t.id FROM tenants t WHERE t.subdomain = 'alpha'
UNION ALL SELECT 'Dhanmondi', 'Road-27, Dhanmondi, Dhaka', 'active', t.id FROM tenants t WHERE t.subdomain = 'alpha'
UNION ALL SELECT 'Banani', 'Road-11, Banani, Dhaka', 'active', t.id FROM tenants t WHERE t.subdomain = 'fast'
UNION ALL SELECT 'Gulshan', 'Gulshan-2, Dhaka', 'active', t.id FROM tenants t WHERE t.subdomain = 'fast'
UNION ALL SELECT 'Mohammadpur', 'Town Hall, Mohammadpur', 'active', t.id FROM tenants t WHERE t.subdomain = 'city'
UNION ALL SELECT 'Farmgate', 'Farmgate, Dhaka', 'active', t.id FROM tenants t WHERE t.subdomain = 'city';

-- AlphaNet customers
INSERT INTO customers (customer_id, name, father_name, mother_name, phone, alt_phone, email, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, pop_location, installed_by, box_name, cable_length, tenant_id, package_id)
SELECT 'ALPHA-001', 'Rahim Uddin', 'Abdul Karim', 'Amina Begum', '01712345678', '01812345678', 'rahim@email.com', '1990123456789', 'Businessman', 'Mirpur', 'Mirpur-10', 'Mirpur', 'Dhaka', 'House-45, Road-12, Mirpur-10, Dhaka', 800, 0, 500, 10, 'active', 'active', 'rahim_alpha', 'pass123', '192.168.1.10', '192.168.1.1', '255.255.255.0', '2025-01-15'::date, 'Mirpur POP', 'Technician A', 'Box-M1', '50m', t.id, p.id 
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'alpha' AND p.name = '20 Mbps Standard';

INSERT INTO customers (customer_id, name, father_name, mother_name, phone, alt_phone, email, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, pop_location, installed_by, box_name, cable_length, tenant_id, package_id)
SELECT 'ALPHA-002', 'Kamal Hossain', 'Jamal Hossain', 'Fatima Khatun', '01798765432', '01898765432', 'kamal@email.com', '1985234567890', 'Teacher', 'Uttara', 'Sector-7', 'Uttara', 'Dhaka', 'House-22, Sector-7, Uttara', 500, 0, 500, 15, 'active', 'active', 'kamal_alpha', 'pass456', '192.168.1.11', '192.168.1.1', '255.255.255.0', '2025-02-01'::date, 'Uttara POP', 'Technician B', 'Box-U1', '30m', t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'alpha' AND p.name = '10 Mbps Basic';

INSERT INTO customers (customer_id, name, father_name, mother_name, phone, email, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, pop_location, installed_by, box_name, cable_length, tenant_id, package_id)
SELECT 'ALPHA-003', 'Nasima Akter', 'Rafiq Ahmed', 'Salma Begum', '01611223344', 'nasima@email.com', '1995345678901', 'Student', 'Dhanmondi', 'Road-27', 'Dhanmondi', 'Dhaka', 'Flat-3B, Road-27, Dhanmondi', 1500, 100, 500, 20, 'active', 'active', 'nasima_alpha', 'pass789', '192.168.1.12', '192.168.1.1', '255.255.255.0', '2025-03-10'::date, 'Dhanmondi POP', 'Technician A', 'Box-D1', '25m', t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'alpha' AND p.name = '50 Mbps Premium';

INSERT INTO customers (customer_id, name, father_name, mother_name, phone, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, pop_location, installed_by, box_name, cable_length, tenant_id, package_id)
SELECT 'ALPHA-004', 'Jahangir Alam', 'Nurul Islam', 'Hasina Begum', '01556677889', '1988456789012', 'Engineer', 'Mirpur', 'Mirpur-12', 'Mirpur', 'Dhaka', 'House-78, Mirpur-12', 800, 50, 500, 10, 'active', 'active', 'jahangir_alpha', 'passabc', '192.168.1.13', '192.168.1.1', '255.255.255.0', '2025-01-20'::date, 'Mirpur POP', 'Technician C', 'Box-M2', '40m', t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'alpha' AND p.name = '20 Mbps Standard';

INSERT INTO customers (customer_id, name, father_name, mother_name, phone, alt_phone, email, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, pop_location, installed_by, box_name, cable_length, tenant_id, package_id)
SELECT 'ALPHA-005', 'Sufia Rahman', 'Abdur Rahman', 'Kulsum Begum', '01933445566', '01733445566', 'sufia@email.com', '1992567890123', 'Doctor', 'Uttara', 'Sector-4', 'Uttara', 'Dhaka', 'House-15, Sector-4, Uttara', 500, 0, 500, 5, 'active', 'suspended', 'sufia_alpha', 'passxyz', '192.168.1.14', '192.168.1.1', '255.255.255.0', '2024-11-05'::date, 'Uttara POP', 'Technician B', 'Box-U2', '60m', t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'alpha' AND p.name = '10 Mbps Basic';

-- FastFiber customers
INSERT INTO customers (customer_id, name, father_name, phone, email, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, tenant_id, package_id)
SELECT 'FAST-001', 'Mizanur Rahman', 'Shamsul Haque', '01411223344', 'mizan@email.com', '1991678901234', 'Shopkeeper', 'Banani', 'Road-11', 'Banani', 'Dhaka', 'Shop-5, Road-11, Banani', 800, 0, 600, 12, 'active', 'active', 'mizan_fast', 'fpass1', '10.0.0.10', '10.0.0.1', '255.255.255.0', '2025-04-01'::date, t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'fast' AND p.name = '20 Mbps Pro';

INSERT INTO customers (customer_id, name, father_name, phone, email, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, tenant_id, package_id)
SELECT 'FAST-002', 'Taslima Nasreen', 'Abul Kashem', '01322334455', 'taslima@email.com', '1993789012345', 'Journalist', 'Gulshan', 'Gulshan-2', 'Gulshan', 'Dhaka', 'Apt-6A, Gulshan-2', 1500, 200, 600, 18, 'active', 'active', 'taslima_fast', 'fpass2', '10.0.0.11', '10.0.0.1', '255.255.255.0', '2025-03-15'::date, t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'fast' AND p.name = '50 Mbps Ultra';

INSERT INTO customers (customer_id, name, father_name, phone, nid, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, tenant_id, package_id)
SELECT 'FAST-003', 'Faruk Ahmed', 'Sirajul Islam', '01599887766', '1987890123456', 'Driver', 'Banani', 'Road-5', 'Banani', 'Dhaka', 'House-33, Road-5, Banani', 500, 0, 600, 8, 'active', 'active', 'faruk_fast', 'fpass3', '10.0.0.12', '10.0.0.1', '255.255.255.0', '2025-05-01'::date, t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'fast' AND p.name = '10 Mbps Starter';

-- CityLink customers
INSERT INTO customers (customer_id, name, father_name, phone, email, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, tenant_id, package_id)
SELECT 'CITY-001', 'Habibur Rahman', 'Matiur Rahman', '01244556677', 'habib@email.com', 'Pharmacist', 'Mohammadpur', 'Town Hall', 'Mohammadpur', 'Dhaka', 'House-12, Town Hall, Mohammadpur', 800, 0, 400, 10, 'active', 'active', 'habib_city', 'cpass1', '172.16.0.10', '172.16.0.1', '255.255.255.0', '2025-02-20'::date, t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'city' AND p.name = '20 Mbps Regular';

INSERT INTO customers (customer_id, name, father_name, phone, email, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, tenant_id, package_id)
SELECT 'CITY-002', 'Roksana Parvin', 'Abdul Mannan', '01155667788', 'roksana@email.com', 'Nurse', 'Farmgate', 'Farmgate', 'Farmgate', 'Dhaka', 'Flat-2C, Farmgate, Dhaka', 1500, 0, 400, 15, 'active', 'active', 'roksana_city', 'cpass2', '172.16.0.11', '172.16.0.1', '255.255.255.0', '2025-06-01'::date, t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'city' AND p.name = '50 Mbps Business';

INSERT INTO customers (customer_id, name, father_name, phone, occupation, area, village, post_office, district, permanent_address, monthly_bill, discount, connectivity_fee, due_date_day, status, connection_status, pppoe_username, pppoe_password, ip_address, gateway, subnet, installation_date, tenant_id, package_id)
SELECT 'CITY-003', 'Shafiqul Islam', 'Azizul Islam', '01866778899', 'Farmer', 'Mohammadpur', 'Shyamoli', 'Mohammadpur', 'Dhaka', 'House-88, Shyamoli', 500, 0, 400, 20, 'active', 'suspended', 'shafiq_city', 'cpass3', '172.16.0.12', '172.16.0.1', '255.255.255.0', '2024-12-10'::date, t.id, p.id
FROM tenants t JOIN packages p ON p.tenant_id = t.id WHERE t.subdomain = 'city' AND p.name = '10 Mbps Economy';

-- General settings
INSERT INTO general_settings (site_name, email, mobile, address, tenant_id)
SELECT 'AlphaNet ISP', 'admin@alphanet.com', '01712345000', 'Mirpur-10, Dhaka-1216', id FROM tenants WHERE subdomain = 'alpha'
UNION ALL SELECT 'FastFiber ISP', 'admin@fastfiber.com', '01398765000', 'Banani, Dhaka-1213', id FROM tenants WHERE subdomain = 'fast'
UNION ALL SELECT 'CityLink ISP', 'admin@citylink.com', '01244556000', 'Mohammadpur, Dhaka-1207', id FROM tenants WHERE subdomain = 'city';

-- SMS settings
INSERT INTO sms_settings (sender_id, sms_on_registration, sms_on_bill_generate, sms_on_payment, sms_on_suspension, tenant_id)
SELECT 'AlphaNet', true, true, true, true, id FROM tenants WHERE subdomain = 'alpha'
UNION ALL SELECT 'FastFiber', true, true, true, true, id FROM tenants WHERE subdomain = 'fast'
UNION ALL SELECT 'CityLink', true, true, true, true, id FROM tenants WHERE subdomain = 'city';

-- SMS templates
INSERT INTO sms_templates (name, message, tenant_id) VALUES
  ('Welcome', 'Dear {CustomerName}, welcome to AlphaNet ISP! Your connection is active.', (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('Bill Reminder', 'Dear {CustomerName}, your bill of BDT {Amount} for {Month} is due on {DueDate}.', (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('Payment Confirmation', 'Dear {CustomerName}, we received BDT {Amount} for {Month}. Thank you!', (SELECT id FROM tenants WHERE subdomain = 'alpha')),
  ('Welcome', 'Welcome to FastFiber! Your {Package} package is now active.', (SELECT id FROM tenants WHERE subdomain = 'fast')),
  ('Bill Reminder', 'FastFiber: Your bill of BDT {Amount} is due. Pay to avoid disconnection.', (SELECT id FROM tenants WHERE subdomain = 'fast')),
  ('Welcome', 'CityLink ISP: Welcome {CustomerName}! Enjoy your internet.', (SELECT id FROM tenants WHERE subdomain = 'city')),
  ('Bill Reminder', 'CityLink: BDT {Amount} due for {Month}. Pay before {DueDate}.', (SELECT id FROM tenants WHERE subdomain = 'city'));
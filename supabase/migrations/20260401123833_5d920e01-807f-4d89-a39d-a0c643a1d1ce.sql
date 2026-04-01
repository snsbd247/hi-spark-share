
-- Plans
INSERT INTO saas_plans (id, name, slug, description, price_monthly, price_yearly, max_customers, max_users, max_routers, has_accounting, has_hr, has_inventory, has_sms, has_custom_domain, sort_order) VALUES
('a1000000-0000-0000-0000-000000000001', 'Basic', 'basic', 'ছোট ISP দের জন্য বেসিক প্ল্যান', 500, 5000, 100, 3, 1, false, false, false, true, false, 1),
('a1000000-0000-0000-0000-000000000002', 'Professional', 'professional', 'মাঝারি ISP দের জন্য প্রফেশনাল প্ল্যান', 1500, 15000, 500, 10, 5, true, true, false, true, true, 2),
('a1000000-0000-0000-0000-000000000003', 'Enterprise', 'enterprise', 'বড় ISP দের জন্য এন্টারপ্রাইজ প্ল্যান', 3000, 30000, 99999, 50, 20, true, true, true, true, true, 3)
ON CONFLICT (slug) DO NOTHING;

-- Tenants
INSERT INTO tenants (id, name, subdomain, email, phone, status, plan) VALUES
('b1000000-0000-0000-0000-000000000001', 'SpeedNet BD', 'speednet', 'admin@speednetbd.com', '01711111111', 'active', 'professional'),
('b1000000-0000-0000-0000-000000000002', 'FiberLink ISP', 'fiberlink', 'admin@fiberlinkisp.com', '01722222222', 'active', 'enterprise'),
('b1000000-0000-0000-0000-000000000003', 'NetZone IT', 'netzone', 'admin@netzoneit.com', '01733333333', 'active', 'basic'),
('b1000000-0000-0000-0000-000000000004', 'RapidNet', 'rapidnet', 'admin@rapidnet.com.bd', '01744444444', 'active', 'professional'),
('b1000000-0000-0000-0000-000000000005', 'CityBroadband', 'citybb', 'admin@citybroadband.net', '01755555555', 'active', 'enterprise')
ON CONFLICT (subdomain) DO NOTHING;

-- Subscriptions
INSERT INTO subscriptions (tenant_id, plan_id, billing_cycle, start_date, end_date, status, amount, payment_method) VALUES
('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'monthly', '2026-04-01', '2026-05-01', 'active', 1500, 'bkash'),
('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'yearly', '2026-01-01', '2027-01-01', 'active', 30000, 'bank_transfer'),
('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'monthly', '2026-04-01', '2026-05-01', 'active', 500, 'nagad'),
('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'yearly', '2026-03-01', '2027-03-01', 'active', 15000, 'bkash'),
('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', 'monthly', '2026-04-01', '2026-05-01', 'active', 3000, 'bank_transfer');

-- Domains
INSERT INTO domains (tenant_id, domain, is_primary, is_verified) VALUES
('b1000000-0000-0000-0000-000000000001', 'billing.speednetbd.com', true, true),
('b1000000-0000-0000-0000-000000000002', 'portal.fiberlinkisp.com', true, true),
('b1000000-0000-0000-0000-000000000003', 'billing.netzoneit.com', true, false),
('b1000000-0000-0000-0000-000000000004', 'billing.rapidnet.com.bd', true, true),
('b1000000-0000-0000-0000-000000000005', 'portal.citybroadband.net', true, true);

-- SMS Wallets
INSERT INTO sms_wallets (tenant_id, balance) VALUES
('b1000000-0000-0000-0000-000000000001', 500),
('b1000000-0000-0000-0000-000000000002', 2000),
('b1000000-0000-0000-0000-000000000003', 100),
('b1000000-0000-0000-0000-000000000004', 750),
('b1000000-0000-0000-0000-000000000005', 1500);

-- SMS Transactions (recharge records)
INSERT INTO sms_transactions (tenant_id, amount, type, description) VALUES
('b1000000-0000-0000-0000-000000000001', 500, 'credit', 'প্রাথমিক SMS রিচার্জ - Super Admin'),
('b1000000-0000-0000-0000-000000000002', 2000, 'credit', 'প্রাথমিক SMS রিচার্জ - Super Admin'),
('b1000000-0000-0000-0000-000000000003', 100, 'credit', 'প্রাথমিক SMS রিচার্জ - Super Admin'),
('b1000000-0000-0000-0000-000000000004', 750, 'credit', 'প্রাথমিক SMS রিচার্জ - Super Admin'),
('b1000000-0000-0000-0000-000000000005', 1500, 'credit', 'প্রাথমিক SMS রিচার্জ - Super Admin');

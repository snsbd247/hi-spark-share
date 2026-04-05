
-- ═══ RESELLER children ═══
DELETE FROM reseller_package_commissions;
DELETE FROM customer_reseller_migrations;
DELETE FROM customer_bandwidth_usages;
DELETE FROM reseller_zones;
DELETE FROM reseller_packages;
DELETE FROM reseller_commissions;
DELETE FROM reseller_wallet_transactions;
DELETE FROM reseller_sessions;

-- ═══ CUSTOMER children ═══
DELETE FROM customer_devices;
DELETE FROM customer_sessions;
DELETE FROM customer_ledger;
DELETE FROM payments;
DELETE FROM bills;
DELETE FROM support_tickets;
DELETE FROM merchant_payments;

-- ═══ FIBER / NETWORK children ═══
DELETE FROM core_connections;
DELETE FROM fiber_onus;
DELETE FROM fiber_splitter_outputs;
DELETE FROM fiber_splitters;
DELETE FROM fiber_cores;
DELETE FROM fiber_cables;
DELETE FROM fiber_pon_ports;
DELETE FROM fiber_olts;
DELETE FROM network_links;
DELETE FROM network_nodes;
DELETE FROM ip_pools;

-- ═══ INVENTORY ═══
DELETE FROM inventory_logs;
DELETE FROM product_serials;
DELETE FROM sales;
DELETE FROM purchases;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM suppliers;
DELETE FROM supplier_payments;

-- ═══ HR ═══
DELETE FROM attendance;
DELETE FROM salary_sheets;
DELETE FROM loans;
DELETE FROM employee_provident_fund;
DELETE FROM employee_savings_fund;
DELETE FROM employee_salary_structure;
DELETE FROM employee_emergency_contacts;
DELETE FROM employee_experience;
DELETE FROM employee_education;
DELETE FROM employees;
DELETE FROM designations;

-- ═══ ACCOUNTING ═══
DELETE FROM transactions;
DELETE FROM expenses;
DELETE FROM income_heads;
DELETE FROM expense_heads;
DELETE FROM accounts;

-- ═══ TENANT infra ═══
DELETE FROM impersonations;
DELETE FROM notifications;
DELETE FROM login_histories;
DELETE FROM activity_logs;
DELETE FROM audit_logs;
DELETE FROM subscriptions;
DELETE FROM domains;
DELETE FROM custom_roles;
DELETE FROM general_settings;
DELETE FROM system_settings;
DELETE FROM payment_gateways;
DELETE FROM demo_requests;
DELETE FROM tenant_company_info;
DELETE FROM profiles;
DELETE FROM mikrotik_routers;
DELETE FROM packages;

-- ═══ MAIN tables ═══
DELETE FROM resellers;
DELETE FROM customers;
DELETE FROM tenants;

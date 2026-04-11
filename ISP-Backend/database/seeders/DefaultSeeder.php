<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\CustomRole;
use App\Models\GeneralSetting;
use App\Models\Module;
use App\Models\Package;
use App\Models\Permission;
use App\Models\Reseller;
use App\Models\SmsTemplate;
use App\Models\SuperAdmin;
use App\Models\SystemSetting;
use App\Models\Tenant;
use App\Models\TenantCompanyInfo;
use App\Models\Domain;
use App\Models\User;
use App\Models\SmsSetting;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DefaultSeeder extends Seeder
{
    private const DEFAULT_SUPER_ADMIN_EMAIL = 'superadmin@smartispapp.com';
    private const DEFAULT_SUPER_ADMIN_USERNAME = 'superadmin';
    private const DEFAULT_SUPER_ADMIN_PASSWORD = 'Admin@123';

    public function run(): void
    {
        $this->seedRoles();
        $this->seedSuperAdmin();
        $this->seedDefaultTenant();
        $this->seedAdminUsers();
        $this->seedReseller();
        $this->seedGeneralSettings();
        $this->seedSystemSettings();
        $this->seedSmsSettings();
        $this->seedSmsTemplates();
        $this->seedEmailTemplates();
        $this->seedPackages();
        $this->seedChartOfAccounts();
        $this->seedLedgerMappings();
        $this->seedPermissions();
        $this->seedModules();
        $this->seedLandingSections();

        $this->command->info('');
        $this->command->info('╔════════════════════════════════════════════════════╗');
        $this->command->info('║          ✅  Default Data Seeded Successfully      ║');
        $this->command->info('╠════════════════════════════════════════════════════╣');
        $this->command->info('║  Super Admin Login:                                ║');
        $this->command->info('║    Username: superadmin                            ║');
        $this->command->info('║    Password: Admin@123                             ║');
        $this->command->info('╠════════════════════════════════════════════════════╣');
        $this->command->info('║  Tenant Admin Login:                               ║');
        $this->command->info('║    Username: snb_admin                             ║');
        $this->command->info('║    Password: 123456                                ║');
        $this->command->info('╠════════════════════════════════════════════════════╣');
        $this->command->info('║  Reseller Login:                                   ║');
        $this->command->info('║    Username: sagorkhan                             ║');
        $this->command->info('║    Password: 123456                                ║');
        $this->command->info('╚════════════════════════════════════════════════════╝');
    }

    // ── Roles ────────────────────────────────────────────
    private function seedRoles(): void
    {
        $roles = [
            ['name' => 'Super Admin', 'description' => 'Full system access',    'db_role' => 'super_admin', 'is_system' => true],
            ['name' => 'Admin',       'description' => 'Full tenant access',     'db_role' => 'admin',       'is_system' => true],
            ['name' => 'Owner',       'description' => 'Tenant owner',           'db_role' => 'owner',       'is_system' => true],
            ['name' => 'Manager',     'description' => 'Management access',      'db_role' => 'manager',     'is_system' => true],
            ['name' => 'Staff',       'description' => 'Basic operations',       'db_role' => 'staff',       'is_system' => false],
            ['name' => 'Technician',  'description' => 'Technical support',      'db_role' => 'technician',  'is_system' => false],
            ['name' => 'Accountant',  'description' => 'Finance operations',     'db_role' => 'accountant',  'is_system' => false],
        ];
        foreach ($roles as $role) {
            CustomRole::firstOrCreate(['name' => $role['name']], $role);
        }
    }

    private function seedSuperAdmin(): void
    {
        SuperAdmin::updateOrCreate(
            ['email' => self::DEFAULT_SUPER_ADMIN_EMAIL],
            [
                'name' => 'Super Admin',
                'username' => self::DEFAULT_SUPER_ADMIN_USERNAME,
                'password_hash' => Hash::make(self::DEFAULT_SUPER_ADMIN_PASSWORD),
                'status' => 'active',
                'failed_attempts' => 0,
                'locked_until' => null,
            ]
        );
    }

    // ── Default Tenant ──────────────────────────────────
    private ?string $defaultTenantId = null;

    private function seedDefaultTenant(): void
    {
        $tenant = Tenant::firstOrCreate(
            ['subdomain' => 'demo'],
            [
                'name' => 'SNB Networks',
                'email' => 'snb@smartisp.com',
                'phone' => '01700000000',
                'status' => 'active',
                'plan' => 'enterprise',
            ]
        );
        $this->defaultTenantId = $tenant->id;

        Domain::firstOrCreate(
            ['domain' => 'demo.smartispapp.com'],
            [
                'tenant_id' => $tenant->id,
                'is_primary' => true,
                'is_verified' => true,
            ]
        );

        TenantCompanyInfo::firstOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'company_name' => 'SNB Networks',
                'phone' => '01700000000',
                'email' => 'snb@smartisp.com',
                'invoice_prefix' => 'SNB',
            ]
        );
    }

    // ── Admin / Tenant / Reseller Users ─────────────────
    private function seedAdminUsers(): void
    {
        $ownerRole = CustomRole::where('name', 'Owner')->first();

        // ── Tenant Admin (Owner) ──
        $tenantAdmin = User::firstOrCreate(
            ['username' => 'snb_admin'],
            [
                'full_name' => 'SNB Admin',
                'email' => 'snb@smartisp.com',
                'password_hash' => Hash::make('123456'),
                'status' => 'active',
                'tenant_id' => $this->defaultTenantId,
            ]
        );
        // Update tenant_id if already exists but was null
        if (!$tenantAdmin->tenant_id && $this->defaultTenantId) {
            $tenantAdmin->update(['tenant_id' => $this->defaultTenantId]);
        }
        if ($ownerRole) {
            UserRole::firstOrCreate(
                ['user_id' => $tenantAdmin->id],
                ['role' => 'owner', 'custom_role_id' => $ownerRole->id]
            );
        }
    }

    // ── Reseller ─────────────────────────────────────────
    private function seedReseller(): void
    {
        Reseller::firstOrCreate(
            ['user_id' => 'sagorkhan'],
            [
                'name' => 'Sagor Khan',
                'company_name' => 'Sagor Networks',
                'email' => 'sagor@smartisp.com',
                'phone' => '01700000001',
                'password_hash' => Hash::make('123456'),
                'wallet_balance' => 0,
                'commission_rate' => 10,
                'default_commission' => 10,
                'status' => 'active',
                'allow_all_packages' => true,
                'tenant_id' => $this->defaultTenantId,
            ]
        );
    }

    // ── General Settings ─────────────────────────────────
    private function seedGeneralSettings(): void
    {
        if (GeneralSetting::count() === 0) {
            GeneralSetting::create([
                'site_name' => 'Smart ISP',
                'primary_color' => '#3B82F6',
                'email' => 'info@smartispapp.com',
                'mobile' => '01700000000',
                'address' => '',
                'support_email' => 'support@smartispapp.com',
                'support_phone' => '01700000000',
            ]);
        }
    }

    // ── System Settings ──────────────────────────────────
    private function seedSystemSettings(): void
    {
        $settings = [
            'footer_text' => '© 2025-{year} ISP Billing System. All Rights Reserved.',
            'company_name' => 'ISP Billing System',
            'footer_link' => '#',
            'footer_developer' => 'Sync & Solutions IT',
            'system_version' => '1.0.8',
            'auto_update_year' => 'true',
            'enabled_modules' => '["dashboard","customers","billing","payments","merchant_payments","tickets","sms","accounting","inventory","supplier","reports","users","roles","settings","hr","mikrotik","packages","fiber_network","reseller","network_map","live_bandwidth"]',
            'invoice_footer' => 'Thank you for using our internet service.',
            'ledger_type' => 'running_balance',
            'branding_footer_text' => 'Smart ISP - Complete ISP Management Solution',
            'branding_copyright_text' => '© {year} Smart ISP. All rights reserved.',
        ];
        foreach ($settings as $key => $value) {
            SystemSetting::firstOrCreate(['setting_key' => $key], ['setting_value' => $value]);
        }
    }

    // ── SMS Settings ─────────────────────────────────────
    private function seedSmsSettings(): void
    {
        if (SmsSetting::count() === 0) {
            SmsSetting::create([
                'sms_on_bill_generate' => true,
                'sms_on_payment' => true,
                'sms_on_registration' => true,
                'sms_on_suspension' => true,
                'sms_on_new_customer_bill' => true,
            ]);
        }
    }

    // ── SMS Templates ────────────────────────────────────
    private function seedSmsTemplates(): void
    {
        $templates = [
            ['name' => 'Bill Generated', 'message' => 'Dear {CustomerName}, your bill for {Month} is {Amount} BDT. Due date: {DueDate}. Customer ID: {CustomerID}.'],
            ['name' => 'Due Reminder', 'message' => 'Dear {CustomerName}, your bill of {Amount} BDT for {Month} is due. Please pay before {DueDate}.'],
            ['name' => 'Payment Confirmation', 'message' => 'Dear {CustomerName}, we received your payment of {Amount} BDT on {PaymentDate}. Thank you!'],
            ['name' => 'Account Suspension', 'message' => 'Dear {CustomerName}, your internet service has been suspended due to overdue payment. Please pay your bill to restore service. Customer ID: {CustomerID}.'],
            ['name' => 'Customer Registration', 'message' => 'Dear {CustomerName}, welcome to Smart ISP! Your Customer ID: {CustomerID}. PPPoE Username: {PPPoEUsername}, Password: {PPPoEPassword}.'],
            ['name' => 'Bill Reminder', 'message' => 'Reminder: Your internet bill of {Amount} BDT is due tomorrow ({DueDate}). Please pay to avoid service suspension.'],
            ['name' => 'Service Restored', 'message' => 'Dear {CustomerName}, your internet service has been restored. Thank you for your payment!'],
            ['name' => 'Package Upgrade', 'message' => 'Dear {CustomerName}, your internet package has been upgraded. Enjoy faster speed!'],
        ];
        foreach ($templates as $tpl) {
            SmsTemplate::firstOrCreate(['name' => $tpl['name']], ['message' => $tpl['message']]);
        }
    }

    // ── Email Templates (as system_settings) ─────────────
    private function seedEmailTemplates(): void
    {
        $templates = [
            'email_tpl_welcome' => "প্রিয় {CustomerName},\n\n{CompanyName}-এ আপনাকে স্বাগতম! আপনার ইন্টারনেট সংযোগ সফলভাবে চালু করা হয়েছে।\n\nআপনার একাউন্ট সংক্রান্ত যেকোনো তথ্যের জন্য আমাদের কাস্টমার পোর্টালে লগইন করুন।\n\nধন্যবাদ,\n{CompanyName} টিম",
            'email_tpl_password_reset' => "প্রিয় {CustomerName},\n\nআপনার পাসওয়ার্ড রিসেট করার অনুরোধ পাওয়া গেছে। নিচের লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন:\n\n🔗 {ResetLink}\n\nএই লিংকটি ৩০ মিনিট পর্যন্ত কার্যকর থাকবে।\n\nধন্যবাদ,\n{CompanyName} টিম",
            'email_tpl_payment_confirm' => "প্রিয় {CustomerName},\n\nআপনার {Month} মাসের বিলের পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে।\n\nপেমেন্টের পরিমাণ: ৳{Amount}\nপেমেন্টের তারিখ: {PaymentDate}\n\nধন্যবাদ,\n{CompanyName} টিম",
            'email_tpl_ticket_reply' => "প্রিয় {CustomerName},\n\nআপনার সাপোর্ট টিকেট #{TicketID}-এ নতুন রিপ্লাই এসেছে।\n\nবিস্তারিত দেখতে কাস্টমার পোর্টালে লগইন করুন।\n\nধন্যবাদ,\n{CompanyName} সাপোর্ট টিম",
            'email_tpl_account_activation' => "প্রিয় {CustomerName},\n\nআপনার একাউন্ট সফলভাবে সক্রিয় করা হয়েছে! এখন থেকে আপনি আমাদের ইন্টারনেট সেবা উপভোগ করতে পারবেন।\n\nধন্যবাদ,\n{CompanyName} টিম",
        ];
        foreach ($templates as $key => $value) {
            SystemSetting::firstOrCreate(['setting_key' => $key], ['setting_value' => $value]);
        }
    }

    // ── Packages ─────────────────────────────────────────
    private function seedPackages(): void
    {
        if (Package::count() === 0) {
            $packages = [
                ['name' => 'Basic 10Mbps', 'speed' => '10 Mbps', 'monthly_price' => 500, 'download_speed' => 10, 'upload_speed' => 10],
                ['name' => 'Standard 20Mbps', 'speed' => '20 Mbps', 'monthly_price' => 800, 'download_speed' => 20, 'upload_speed' => 20],
                ['name' => 'Premium 50Mbps', 'speed' => '50 Mbps', 'monthly_price' => 1200, 'download_speed' => 50, 'upload_speed' => 50],
                ['name' => 'Ultra 100Mbps', 'speed' => '100 Mbps', 'monthly_price' => 2000, 'download_speed' => 100, 'upload_speed' => 100],
            ];
            foreach ($packages as $pkg) {
                Package::create($pkg);
            }
        }
    }

    // ── Chart of Accounts (ISP-specific hierarchy) ───────
    private function seedChartOfAccounts(): void
    {
        if (Account::count() > 0) return;

        $coa = [
            // Assets (1000)
            ['name' => 'Assets', 'code' => '1000', 'type' => 'asset', 'level' => 0, 'is_system' => true, 'parent_code' => null],
            ['name' => 'Cash in Hand', 'code' => '1001', 'type' => 'asset', 'level' => 1, 'is_system' => false, 'parent_code' => '1000'],
            ['name' => 'Cash at Bank', 'code' => '1002', 'type' => 'asset', 'level' => 1, 'is_system' => false, 'parent_code' => '1000'],
            ['name' => 'bKash / Nagad Account', 'code' => '1003', 'type' => 'asset', 'level' => 1, 'is_system' => false, 'parent_code' => '1000'],
            ['name' => 'Accounts Receivable', 'code' => '1010', 'type' => 'asset', 'level' => 1, 'is_system' => true, 'parent_code' => '1000'],
            ['name' => 'Customer Receivable', 'code' => '1011', 'type' => 'asset', 'level' => 2, 'is_system' => false, 'parent_code' => '1010'],
            ['name' => 'Employee Advance / Receivable', 'code' => '1012', 'type' => 'asset', 'level' => 2, 'is_system' => false, 'parent_code' => '1010'],
            ['name' => 'Other Receivable', 'code' => '1019', 'type' => 'asset', 'level' => 2, 'is_system' => false, 'parent_code' => '1010'],
            ['name' => 'Inventory (Network Equipment)', 'code' => '1020', 'type' => 'asset', 'level' => 1, 'is_system' => false, 'parent_code' => '1000'],
            ['name' => 'Fixed Assets', 'code' => '1100', 'type' => 'asset', 'level' => 1, 'is_system' => true, 'parent_code' => '1000'],
            ['name' => 'Network Infrastructure', 'code' => '1101', 'type' => 'asset', 'level' => 2, 'is_system' => false, 'parent_code' => '1100'],
            ['name' => 'Office Equipment', 'code' => '1102', 'type' => 'asset', 'level' => 2, 'is_system' => false, 'parent_code' => '1100'],
            ['name' => 'Vehicles', 'code' => '1103', 'type' => 'asset', 'level' => 2, 'is_system' => false, 'parent_code' => '1100'],

            // Liabilities (2000)
            ['name' => 'Liabilities', 'code' => '2000', 'type' => 'liability', 'level' => 0, 'is_system' => true, 'parent_code' => null],
            ['name' => 'Accounts Payable', 'code' => '2001', 'type' => 'liability', 'level' => 1, 'is_system' => true, 'parent_code' => '2000'],
            ['name' => 'Vendor / Supplier Payable', 'code' => '2001A', 'type' => 'liability', 'level' => 2, 'is_system' => false, 'parent_code' => '2001'],
            ['name' => 'Other Payable', 'code' => '2001B', 'type' => 'liability', 'level' => 2, 'is_system' => false, 'parent_code' => '2001'],
            ['name' => 'Advance from Customers', 'code' => '2002', 'type' => 'liability', 'level' => 1, 'is_system' => false, 'parent_code' => '2000'],
            ['name' => 'Employee Payable', 'code' => '2003', 'type' => 'liability', 'level' => 1, 'is_system' => true, 'parent_code' => '2000'],
            ['name' => 'Salary Payable', 'code' => '2003A', 'type' => 'liability', 'level' => 2, 'is_system' => false, 'parent_code' => '2003'],
            ['name' => 'Bonus Payable', 'code' => '2003B', 'type' => 'liability', 'level' => 2, 'is_system' => false, 'parent_code' => '2003'],
            ['name' => 'Tax Payable', 'code' => '2004', 'type' => 'liability', 'level' => 1, 'is_system' => false, 'parent_code' => '2000'],
            ['name' => 'Loan Payable', 'code' => '2010', 'type' => 'liability', 'level' => 1, 'is_system' => false, 'parent_code' => '2000'],
            ['name' => 'Provident Fund Payable', 'code' => '2011', 'type' => 'liability', 'level' => 1, 'is_system' => false, 'parent_code' => '2000'],
            ['name' => 'Savings Fund Payable', 'code' => '2012', 'type' => 'liability', 'level' => 1, 'is_system' => false, 'parent_code' => '2000'],

            // Equity (3000)
            ['name' => 'Equity', 'code' => '3000', 'type' => 'equity', 'level' => 0, 'is_system' => true, 'parent_code' => null],
            ['name' => "Owner's Capital", 'code' => '3001', 'type' => 'equity', 'level' => 1, 'is_system' => false, 'parent_code' => '3000'],
            ['name' => 'Retained Earnings', 'code' => '3002', 'type' => 'equity', 'level' => 1, 'is_system' => false, 'parent_code' => '3000'],

            // Income (4000)
            ['name' => 'Income', 'code' => '4000', 'type' => 'income', 'level' => 0, 'is_system' => true, 'parent_code' => null],
            ['name' => 'Monthly Subscription Income', 'code' => '4001', 'type' => 'income', 'level' => 1, 'is_system' => false, 'parent_code' => '4000'],
            ['name' => 'New Connection Fee', 'code' => '4002', 'type' => 'income', 'level' => 1, 'is_system' => false, 'parent_code' => '4000'],
            ['name' => 'Equipment Sales Income', 'code' => '4003', 'type' => 'income', 'level' => 1, 'is_system' => false, 'parent_code' => '4000'],
            ['name' => 'Late Payment Fee', 'code' => '4004', 'type' => 'income', 'level' => 1, 'is_system' => false, 'parent_code' => '4000'],
            ['name' => 'Reconnection Fee', 'code' => '4005', 'type' => 'income', 'level' => 1, 'is_system' => false, 'parent_code' => '4000'],
            ['name' => 'Other Income', 'code' => '4099', 'type' => 'income', 'level' => 1, 'is_system' => false, 'parent_code' => '4000'],

            // Expenses (5000)
            ['name' => 'Expenses', 'code' => '5000', 'type' => 'expense', 'level' => 0, 'is_system' => true, 'parent_code' => null],
            ['name' => 'Bandwidth Cost (ISP/IIG)', 'code' => '5001', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Salary & Wages', 'code' => '5002', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Office Rent', 'code' => '5003', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Electricity Bill', 'code' => '5004', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Network Maintenance', 'code' => '5005', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Equipment Purchase', 'code' => '5006', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Vehicle & Transport', 'code' => '5007', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Marketing & Advertising', 'code' => '5008', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Mobile & Communication', 'code' => '5009', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Government Fees & License', 'code' => '5010', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Provident Fund Expense (Employer)', 'code' => '5011', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
            ['name' => 'Miscellaneous Expense', 'code' => '5099', 'type' => 'expense', 'level' => 1, 'is_system' => false, 'parent_code' => '5000'],
        ];

        // Sort by level to ensure parents are created first
        usort($coa, fn($a, $b) => $a['level'] <=> $b['level']);

        $codeToId = [];
        foreach ($coa as $acct) {
            $parentId = $acct['parent_code'] ? ($codeToId[$acct['parent_code']] ?? null) : null;
            $created = Account::create([
                'name' => $acct['name'],
                'code' => $acct['code'],
                'type' => $acct['type'],
                'level' => $acct['level'],
                'is_system' => $acct['is_system'],
                'parent_id' => $parentId,
            ]);
            $codeToId[$acct['code']] = $created->id;
        }

        // Store code-to-id mapping for ledger settings
        $this->coaCodeToId = $codeToId;
    }

    private array $coaCodeToId = [];

    // ── Ledger Mappings + Payment Settings ───────────────
    private function seedLedgerMappings(): void
    {
        // If COA wasn't just seeded, load existing codes
        if (empty($this->coaCodeToId)) {
            $accounts = Account::whereNotNull('code')->get();
            foreach ($accounts as $acct) {
                $this->coaCodeToId[$acct->code] = $acct->id;
            }
        }

        if (empty($this->coaCodeToId)) return;

        $mappings = [
            'sales_income_account' => '4003',
            'sales_cash_account' => '1001',
            'purchase_expense_account' => '5006',
            'purchase_cash_account' => '1001',
            'service_income_account' => '4001',
            'expense_cash_account' => '1001',
            'salary_expense_account' => '5002',
            'salary_payable_account' => '2003A',
            'salary_cash_account' => '1001',
            'pf_expense_account' => '5011',
            'pf_payable_account' => '2011',
            'savings_fund_payable_account' => '2012',
            'customer_receivable_account' => '1011',
            'vendor_payable_account' => '2001A',
            'employee_advance_account' => '1012',
            'merchant_payment_account_id' => '1003',
            'connection_charge_account_id' => '4002',
            'monthly_bill_account_id' => '4001',
        ];

        foreach ($mappings as $key => $code) {
            $accountId = $this->coaCodeToId[$code] ?? null;
            if ($accountId) {
                SystemSetting::updateOrCreate(
                    ['setting_key' => $key],
                    ['setting_value' => $accountId]
                );
            }
        }
    }

    // ── Permissions & Role-Permission Mapping ───────────
    private function seedPermissions(): void
    {
        $modules = [
            'dashboard', 'customers', 'billing', 'payments', 'merchant_payments',
            'tickets', 'sms', 'accounting', 'inventory', 'hr',
            'supplier', 'reports', 'settings', 'users', 'roles',
            'mikrotik', 'packages', 'fiber_network', 'reseller', 'network_map',
            'live_bandwidth',
        ];

        $permissionIds = [];
        foreach ($modules as $module) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                $perm = Permission::firstOrCreate(
                    ['module' => $module, 'action' => $action],
                    ['description' => ucfirst($action) . ' ' . str_replace('_', ' ', $module)]
                );
                $permissionIds["{$module}.{$action}"] = $perm->id;
            }
        }

        // Now assign permissions to roles
        $this->seedRolePermissions($permissionIds, $modules);
    }

    private function seedRolePermissions(array $permissionIds, array $modules): void
    {
        // Skip if already seeded
        if (\App\Models\RolePermission::count() > 0) return;

        $roles = CustomRole::all()->keyBy('name');

        // Super Admin, Admin & Owner → all permissions
        foreach (['Super Admin', 'Admin', 'Owner'] as $roleName) {
            if (!isset($roles[$roleName])) continue;
            foreach ($permissionIds as $permId) {
                \App\Models\RolePermission::create([
                    'role_id' => $roles[$roleName]->id,
                    'permission_id' => $permId,
                ]);
            }
        }

        // Manager → all except users, roles, settings delete
        if (isset($roles['Manager'])) {
            $managerExclude = ['users.create', 'users.delete', 'roles.create', 'roles.edit', 'roles.delete', 'settings.delete'];
            foreach ($permissionIds as $key => $permId) {
                if (!in_array($key, $managerExclude)) {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Manager']->id,
                        'permission_id' => $permId,
                    ]);
                }
            }
        }

        // Staff → view all + create/edit on core modules
        if (isset($roles['Staff'])) {
            $staffModules = ['dashboard', 'customers', 'billing', 'payments', 'merchant_payments', 'tickets', 'sms', 'packages'];
            foreach ($permissionIds as $key => $permId) {
                [$mod, $act] = explode('.', $key);
                if ($act === 'view' || in_array($mod, $staffModules)) {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Staff']->id,
                        'permission_id' => $permId,
                    ]);
                }
            }
        }

        // Technician → network, mikrotik, fiber, customers/tickets view/edit
        if (isset($roles['Technician'])) {
            $techFullModules = ['mikrotik', 'fiber_network', 'network_map'];
            foreach ($permissionIds as $key => $permId) {
                [$mod, $act] = explode('.', $key);
                if (in_array($mod, $techFullModules) && $act !== 'delete') {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Technician']->id,
                        'permission_id' => $permId,
                    ]);
                } elseif (in_array($mod, ['customers', 'tickets']) && in_array($act, ['view', 'edit'])) {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Technician']->id,
                        'permission_id' => $permId,
                    ]);
                } elseif (in_array($mod, ['dashboard', 'settings']) && $act === 'view') {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Technician']->id,
                        'permission_id' => $permId,
                    ]);
                }
            }
        }

        // Accountant → accounting, payments, billing, expenses, reports, supplier, inventory, hr
        if (isset($roles['Accountant'])) {
            $accModules = ['dashboard', 'accounting', 'payments', 'billing', 'merchant_payments', 'reports', 'supplier', 'inventory', 'hr'];
            foreach ($permissionIds as $key => $permId) {
                [$mod, $act] = explode('.', $key);
                if (in_array($mod, $accModules) || ($act === 'view' && in_array($mod, ['customers']))) {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Accountant']->id,
                        'permission_id' => $permId,
                    ]);
                }
            }
        }
    }

    // ── Modules (21 system modules) ──────────────────────
    private function seedModules(): void
    {
        $modules = [
            ['name' => 'Dashboard',           'slug' => 'dashboard',          'description' => 'Main dashboard overview',           'is_core' => true,  'sort_order' => 1],
            ['name' => 'Customer Management', 'slug' => 'customers',          'description' => 'Customer CRUD and management',      'is_core' => true,  'sort_order' => 2],
            ['name' => 'Billing',             'slug' => 'billing',            'description' => 'Bill generation and management',    'is_core' => true,  'sort_order' => 3],
            ['name' => 'Payments',            'slug' => 'payments',           'description' => 'Payment collection and tracking',   'is_core' => true,  'sort_order' => 4],
            ['name' => 'Merchant Payments',   'slug' => 'merchant_payments',  'description' => 'bKash/Nagad auto-matching',         'is_core' => false, 'sort_order' => 5],
            ['name' => 'Support Tickets',     'slug' => 'tickets',            'description' => 'Customer support ticket system',    'is_core' => false, 'sort_order' => 6],
            ['name' => 'SMS & Reminders',     'slug' => 'sms',               'description' => 'SMS sending and reminders',          'is_core' => false, 'sort_order' => 7],
            ['name' => 'Accounting',          'slug' => 'accounting',         'description' => 'Double-entry accounting system',    'is_core' => false, 'sort_order' => 8],
            ['name' => 'Inventory & Sales',   'slug' => 'inventory',          'description' => 'Product inventory and sales',       'is_core' => false, 'sort_order' => 9],
            ['name' => 'Human Resource',      'slug' => 'hr',                'description' => 'Employee and HR management',         'is_core' => false, 'sort_order' => 10],
            ['name' => 'Supplier Management', 'slug' => 'supplier',           'description' => 'Supplier and purchase management', 'is_core' => false, 'sort_order' => 11],
            ['name' => 'Reports & Analytics', 'slug' => 'reports',            'description' => 'Reports and analytics',             'is_core' => false, 'sort_order' => 12],
            ['name' => 'User Management',     'slug' => 'users',             'description' => 'User account management',            'is_core' => true,  'sort_order' => 13],
            ['name' => 'Roles & Permissions', 'slug' => 'roles',             'description' => 'Role-based access control',          'is_core' => true,  'sort_order' => 14],
            ['name' => 'System Settings',     'slug' => 'settings',           'description' => 'System configuration',              'is_core' => true,  'sort_order' => 15],
            ['name' => 'MikroTik',            'slug' => 'mikrotik',           'description' => 'MikroTik router integration',       'is_core' => false, 'sort_order' => 16],
            ['name' => 'Packages',            'slug' => 'packages',           'description' => 'Internet package management',       'is_core' => true,  'sort_order' => 17],
            ['name' => 'Fiber Network',       'slug' => 'fiber_network',      'description' => 'FTTH topology management',          'is_core' => false, 'sort_order' => 18],
            ['name' => 'Reseller',            'slug' => 'reseller',           'description' => 'Reseller management system',        'is_core' => false, 'sort_order' => 19],
            ['name' => 'Network Map',         'slug' => 'network_map',        'description' => 'Visual network topology map',       'is_core' => false, 'sort_order' => 20],
            ['name' => 'Live Bandwidth',      'slug' => 'live_bandwidth',     'description' => 'Real-time bandwidth monitoring',    'is_core' => false, 'sort_order' => 21],
        ];

        foreach ($modules as $module) {
            Module::firstOrCreate(
                ['slug' => $module['slug']],
                $module
            );
        }
    }

    // ── Landing Page Default Sections ────────────────────
    private function seedLandingSections(): void
    {
        if (\App\Models\LandingSection::count() > 0) return;

        $sections = [
            // ── Hero ──
            [
                'section_type' => 'hero',
                'title' => 'ISP ব্যবসার জন্য সম্পূর্ণ ম্যানেজমেন্ট সলিউশন',
                'subtitle' => 'Smart ISP',
                'description' => 'বিলিং, কাস্টমার ম্যানেজমেন্ট, MikroTik ইন্টিগ্রেশন, SMS নোটিফিকেশন, এবং আরও অনেক কিছু — একটি প্ল্যাটফর্মে।',
                'sort_order' => 1,
                'is_active' => true,
                'metadata' => json_encode([
                    'badge' => '🚀 Bangladesh #1 ISP Management Platform',
                    'cta_nav' => 'Get Started',
                    'cta_primary' => 'ডেমো রিকোয়েস্ট করুন',
                    'cta_secondary' => 'Watch Demo',
                    'demo_title' => 'ডেমো রিকোয়েস্ট করুন',
                    'demo_subtitle' => 'আমাদের সফটওয়্যার ব্যবহার করতে চান? নিচের ফর্মটি পূরণ করুন।',
                    'hero_badges' => ['No Setup Fee', '24/7 Support', 'Free Trial', 'Bangla Interface'],
                    'nav_links' => [
                        ['label' => 'FEATURES', 'href' => '#features'],
                        ['label' => 'PRICING', 'href' => '#pricing'],
                        ['label' => 'FAQ', 'href' => '#faq'],
                        ['label' => 'CONTACT', 'href' => '#signup'],
                    ],
                    'pricing_title' => 'Package & Pricing',
                    'pricing_subtitle' => 'আপনার ISP ব্যবসার জন্য সেরা প্ল্যান বেছে নিন',
                ]),
            ],

            // ── Stats ──
            ['section_type' => 'stat', 'title' => '500+', 'subtitle' => 'Active ISP Clients', 'icon' => 'Users', 'sort_order' => 2, 'is_active' => true],
            ['section_type' => 'stat', 'title' => '50,000+', 'subtitle' => 'Customers Managed', 'icon' => 'Globe', 'sort_order' => 3, 'is_active' => true],
            ['section_type' => 'stat', 'title' => '99.9%', 'subtitle' => 'System Uptime', 'icon' => 'Shield', 'sort_order' => 4, 'is_active' => true],
            ['section_type' => 'stat', 'title' => '24/7', 'subtitle' => 'Support Available', 'icon' => 'Headphones', 'sort_order' => 5, 'is_active' => true],

            // ── Features ──
            ['section_type' => 'feature', 'title' => 'Customer Management', 'subtitle' => 'কাস্টমার ম্যানেজমেন্ট', 'description' => 'সম্পূর্ণ কাস্টমার প্রোফাইল, PPPoE কনফিগারেশন, কানেকশন স্ট্যাটাস ট্র্যাকিং এবং অটোমেটেড নোটিফিকেশন সিস্টেম।', 'icon' => 'Users', 'sort_order' => 10, 'is_active' => true, 'metadata' => json_encode(['section_title' => 'আমাদের ফিচারসমূহ', 'section_subtitle' => 'ISP ব্যবসা পরিচালনার জন্য প্রয়োজনীয় সব টুল এক জায়গায়'])],
            ['section_type' => 'feature', 'title' => 'Billing & Invoice', 'subtitle' => 'বিলিং ও ইনভয়েস', 'description' => 'অটোমেটেড মাসিক বিল জেনারেশন, কাস্টম ইনভয়েস, পেমেন্ট ট্র্যাকিং এবং ডিউ রিমাইন্ডার।', 'icon' => 'Receipt', 'sort_order' => 11, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'MikroTik Integration', 'subtitle' => 'মাইক্রোটিক ইন্টিগ্রেশন', 'description' => 'রাউটার থেকে সরাসরি PPPoE ইউজার ম্যানেজ করুন, ব্যান্ডউইথ কন্ট্রোল এবং রিয়েল-টাইম মনিটরিং।', 'icon' => 'Router', 'sort_order' => 12, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'SMS Notification', 'subtitle' => 'এসএমএস নোটিফিকেশন', 'description' => 'বিল জেনারেট, পেমেন্ট কনফার্মেশন, ডিউ রিমাইন্ডার এবং সার্ভিস আপডেট — সব কিছু অটোমেটিক SMS-এ।', 'icon' => 'MessageSquare', 'sort_order' => 13, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Accounting & Reports', 'subtitle' => 'হিসাবরক্ষণ ও রিপোর্ট', 'description' => 'Chart of Accounts, ডাবল-এন্ট্রি লেজার, ইনকাম-এক্সপেন্স ট্র্যাকিং এবং বিস্তারিত ফাইন্যান্সিয়াল রিপোর্ট।', 'icon' => 'Calculator', 'sort_order' => 14, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'FTTH/Fiber Network', 'subtitle' => 'ফাইবার নেটওয়ার্ক', 'description' => 'OLT, স্প্লিটার, ONU ম্যানেজমেন্ট এবং ফাইবার ট্র্যাকিং — সম্পূর্ণ FTTH নেটওয়ার্ক ম্যাপিং।', 'icon' => 'Cable', 'sort_order' => 15, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'HR & Payroll', 'subtitle' => 'কর্মী ব্যবস্থাপনা ও বেতন', 'description' => 'কর্মী তথ্য, অ্যাটেনডেন্স, লোন ম্যানেজমেন্ট, স্যালারি শীট এবং প্রভিডেন্ট ফান্ড — সবকিছু এক সিস্টেমে।', 'icon' => 'Briefcase', 'sort_order' => 16, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Inventory Management', 'subtitle' => 'পণ্য ও ডিভাইস ম্যানেজমেন্ট', 'description' => 'প্রোডাক্ট ক্যাটালগ, সিরিয়াল ট্র্যাকিং, কাস্টমার ডিভাইস অ্যাসাইনমেন্ট এবং স্টক লগ পরিচালনা।', 'icon' => 'Package', 'sort_order' => 17, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Reseller Management', 'subtitle' => 'রিসেলার ম্যানেজমেন্ট', 'description' => 'রিসেলার ওয়ালেট, কমিশন ক্যালকুলেশন, প্যাকেজ অ্যাক্সেস কন্ট্রোল এবং ইমপারসোনেশন সাপোর্ট।', 'icon' => 'Users', 'sort_order' => 18, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Supplier Management', 'subtitle' => 'সাপ্লায়ার ম্যানেজমেন্ট', 'description' => 'সাপ্লায়ার প্রোফাইল, পার্চেজ অর্ডার, পেমেন্ট ট্র্যাকিং এবং লেজার ম্যানেজমেন্ট।', 'icon' => 'Truck', 'sort_order' => 19, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Support Tickets', 'subtitle' => 'সাপোর্ট টিকেট', 'description' => 'কাস্টমার কমপ্লেইন ট্র্যাকিং, প্রায়োরিটি ম্যানেজমেন্ট এবং রেজোলিউশন হিস্টোরি।', 'icon' => 'Ticket', 'sort_order' => 20, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Payment Gateway', 'subtitle' => 'পেমেন্ট গেটওয়ে', 'description' => 'bKash, Nagad সহ মার্চেন্ট পেমেন্ট ইন্টিগ্রেশন এবং অনলাইন বিল পেমেন্ট সাপোর্ট।', 'icon' => 'CreditCard', 'sort_order' => 21, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Network Map', 'subtitle' => 'নেটওয়ার্ক ম্যাপ', 'description' => 'ইন্টারেক্টিভ ম্যাপে রাউটার, OLT, স্প্লিটার এবং কাস্টমার লোকেশন ভিজুয়ালাইজেশন।', 'icon' => 'Globe', 'sort_order' => 22, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Bandwidth Analytics', 'description' => 'কাস্টমার-ওয়াইজ ব্যান্ডউইথ ব্যবহার ট্র্যাকিং, রিয়েল-টাইম মনিটরিং এবং ডেটা এনালিটিক্স ড্যাশবোর্ড।', 'icon' => 'Activity', 'sort_order' => 25, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Backup & Recovery', 'description' => 'ফুল সিস্টেম ও টেন্যান্ট-ওয়াইজ SQL ব্যাকআপ, ওয়ান-ক্লিক রিস্টোর, অটো ব্যাকআপ শিডিউলিং এবং ডিজাস্টার রিকভারি।', 'icon' => 'DatabaseBackup', 'sort_order' => 26, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Customer Portal', 'description' => 'কাস্টমারদের জন্য ডেডিকেটেড সেলফ-সার্ভিস পোর্টাল — বিল দেখা, পেমেন্ট, টিকেট এবং প্রোফাইল ম্যানেজমেন্ট।', 'icon' => 'UserCircle', 'sort_order' => 27, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'IP Pool Management', 'description' => 'স্ট্যাটিক ও ডায়নামিক IP পুল ম্যানেজমেন্ট, সাবনেট কনফিগারেশন এবং IP অ্যাসাইনমেন্ট ট্র্যাকিং।', 'icon' => 'Network', 'sort_order' => 28, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Advanced Reports', 'description' => 'রেভিনিউ, এক্সপেন্স, প্রফিট-লস, ক্যাশ ফ্লো, ট্রায়াল ব্যালেন্স, ব্যালেন্স শিট — সম্পূর্ণ MIS রিপোর্টিং।', 'icon' => 'BarChart3', 'sort_order' => 29, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Coupon System', 'description' => 'ডিসকাউন্ট কুপন তৈরি, ভ্যালিডিটি কন্ট্রোল, ইউসেজ লিমিট এবং অটো বিল ডিসকাউন্ট অ্যাপ্লিকেশন।', 'icon' => 'Tag', 'sort_order' => 30, 'is_active' => true],
            ['section_type' => 'feature', 'title' => 'Geo Management', 'description' => 'ডিভিশন, জেলা, উপজেলা ভিত্তিক লোকেশন ম্যানেজমেন্ট — কাস্টমার এবং নেটওয়ার্ক ম্যাপিং।', 'icon' => 'MapPin', 'sort_order' => 31, 'is_active' => true],

            // ── Testimonials ──
            ['section_type' => 'testimonial', 'title' => 'Md. Rahim Uddin', 'subtitle' => 'CEO, SpeedNet BD', 'description' => 'Smart ISP আমাদের ISP ব্যবসাকে সম্পূর্ণ বদলে দিয়েছে। বিলিং অটোমেশন এবং MikroTik ইন্টিগ্রেশন অসাধারণ কাজ করে।', 'sort_order' => 20, 'is_active' => true, 'metadata' => json_encode(['avatar' => 'R', 'rating' => 5, 'section_title' => 'আমাদের ক্লায়েন্টদের মতামত'])],
            ['section_type' => 'testimonial', 'title' => 'Fatema Akter', 'subtitle' => 'Manager, FiberLink ISP', 'description' => 'কাস্টমার ম্যানেজমেন্ট এবং SMS নোটিফিকেশন ফিচারটি আমাদের কাস্টমার সার্ভিস উল্লেখযোগ্যভাবে উন্নত করেছে।', 'sort_order' => 21, 'is_active' => true, 'metadata' => json_encode(['avatar' => 'F', 'rating' => 5])],
            ['section_type' => 'testimonial', 'title' => 'Kamal Hossain', 'subtitle' => 'Owner, NetZone ISP', 'description' => 'আগে Excel-এ হিসাব রাখতাম, এখন সব কিছু অটোমেটিক। রিপোর্ট এবং একাউন্টিং মডিউল দারুণ কাজ করে।', 'sort_order' => 22, 'is_active' => true, 'metadata' => json_encode(['avatar' => 'K', 'rating' => 5])],

            // ── FAQs ──
            ['section_type' => 'faq', 'title' => 'Smart ISP কি ধরনের ISP-এর জন্য উপযুক্ত?', 'description' => 'Smart ISP ছোট থেকে বড় সব ধরনের ISP-এর জন্য উপযুক্ত। আপনার ১০ জন কাস্টমার হোক বা ১০,০০০ — আমাদের সিস্টেম সব স্কেলে কাজ করে।', 'sort_order' => 30, 'is_active' => true, 'metadata' => json_encode(['section_title' => 'সচরাচর জিজ্ঞাসা'])],
            ['section_type' => 'faq', 'title' => 'MikroTik রাউটার ছাড়া কি ব্যবহার করা যায়?', 'description' => 'হ্যাঁ, MikroTik ইন্টিগ্রেশন ঐচ্ছিক। আপনি শুধু বিলিং, কাস্টমার ম্যানেজমেন্ট এবং অন্যান্য মডিউল ব্যবহার করতে পারবেন।', 'sort_order' => 31, 'is_active' => true],
            ['section_type' => 'faq', 'title' => 'ডাটা কি নিরাপদ?', 'description' => 'সম্পূর্ণ নিরাপদ। আমরা এনক্রিপ্টেড ডাটাবেস, role-based access control এবং নিয়মিত ব্যাকআপ ব্যবহার করি।', 'sort_order' => 32, 'is_active' => true],
            ['section_type' => 'faq', 'title' => 'সাপোর্ট কিভাবে পাওয়া যায়?', 'description' => 'আমরা ২৪/৭ টেকনিক্যাল সাপোর্ট দিই। ফোন, ইমেইল এবং লাইভ চ্যাটের মাধ্যমে যেকোনো সময় যোগাযোগ করতে পারবেন।', 'sort_order' => 33, 'is_active' => true],
            ['section_type' => 'faq', 'title' => 'কাস্টম ফিচার যোগ করা যায় কি?', 'description' => 'হ্যাঁ, আমরা কাস্টম ডেভেলপমেন্ট সাপোর্ট দিই। আপনার নির্দিষ্ট প্রয়োজন অনুযায়ী ফিচার তৈরি করে দিতে পারি।', 'sort_order' => 34, 'is_active' => true],

            // ── Footer ──
            ['section_type' => 'footer', 'title' => 'About Company', 'subtitle' => 'About Company', 'description' => 'Smart ISP হলো বাংলাদেশের ISP ব্যবসার জন্য তৈরি সবচেয়ে আধুনিক ম্যানেজমেন্ট সফটওয়্যার। আমরা প্রযুক্তির মাধ্যমে ISP পরিচালনাকে সহজ ও দক্ষ করতে প্রতিশ্রুতিবদ্ধ।', 'sort_order' => 40, 'is_active' => true, 'metadata' => json_encode(['company_name' => 'Smart ISP', 'developer' => 'Sync & Solutions IT'])],
            ['section_type' => 'footer', 'title' => 'Quick Links', 'subtitle' => 'Quick Links', 'sort_order' => 41, 'is_active' => true, 'metadata' => json_encode(['links' => [['label' => 'Home', 'href' => '#'], ['label' => 'Features', 'href' => '#features'], ['label' => 'Package & Pricing', 'href' => '#pricing'], ['label' => 'FAQ', 'href' => '#faq'], ['label' => 'Demo Request', 'href' => '#signup']]])],
            ['section_type' => 'footer', 'title' => 'Payment Methods', 'subtitle' => 'Payment Method', 'sort_order' => 42, 'is_active' => true, 'metadata' => json_encode(['bkash' => '01762673162', 'nagad' => '01762673162', 'bank_name' => 'Brac Bank PLC', 'account_name' => 'Md Ismail Hosain', 'account_no' => '1001104098331001'])],
            ['section_type' => 'footer', 'title' => 'Contact Info', 'subtitle' => 'Contact Us', 'sort_order' => 43, 'is_active' => true, 'metadata' => json_encode(['phone' => '01315556633', 'email' => 'info@smartispapp.com', 'address' => '57/1, Omar Ali Lane, Wabda Road, West Rampura, Dhaka-1219, Bangladesh'])],
        ];

        foreach ($sections as $section) {
            \App\Models\LandingSection::create($section);
        }

        $this->command->info('  ✓ Landing sections seeded (' . count($sections) . ' items)');
    }
}

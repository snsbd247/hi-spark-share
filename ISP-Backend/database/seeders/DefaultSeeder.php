<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\CustomRole;
use App\Models\GeneralSetting;
use App\Models\Package;
use App\Models\Permission;
use App\Models\SmsTemplate;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\SmsSetting;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DefaultSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedRoles();
        $this->seedAdminUsers();
        $this->seedGeneralSettings();
        $this->seedSystemSettings();
        $this->seedSmsSettings();
        $this->seedSmsTemplates();
        $this->seedEmailTemplates();
        $this->seedPackages();
        $this->seedChartOfAccounts();
        $this->seedLedgerMappings();
        $this->seedPermissions();

        $this->command->info('Default data seeded!');
        $this->command->info('Admin #1 → username: admin / password: admin123');
        $this->command->info('Admin #2 → username: ismail / password: Admin@123');
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

    // ── Admin Users ──────────────────────────────────────
    private function seedAdminUsers(): void
    {
        $superAdminRole = CustomRole::where('name', 'Super Admin')->first();

        $admins = [
            ['username' => 'admin', 'full_name' => 'Super Admin', 'email' => 'admin@smartisp.com', 'password' => 'admin123'],
            ['username' => 'ismail', 'full_name' => 'Ismail', 'email' => 'ismail@smartisp.com', 'password' => 'Admin@123'],
        ];

        foreach ($admins as $admin) {
            User::firstOrCreate(
                ['username' => $admin['username']],
                [
                    'full_name' => $admin['full_name'],
                    'email' => $admin['email'],
                    'password_hash' => Hash::make($admin['password']),
                    'status' => 'active',
                ]
            );
            $user = User::where('username', $admin['username'])->first();
            if ($user && $superAdminRole) {
                UserRole::firstOrCreate(
                    ['user_id' => $user->id],
                    ['role' => 'super_admin', 'custom_role_id' => $superAdminRole->id]
                );
            }
        }
    }

    // ── General Settings ─────────────────────────────────
    private function seedGeneralSettings(): void
    {
        if (GeneralSetting::count() === 0) {
            GeneralSetting::create([
                'site_name' => 'Smart ISP',
                'primary_color' => '#3B82F6',
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
            'system_version' => '1.0.1',
            'auto_update_year' => 'true',
            'enabled_modules' => '["billing","payments","merchant_payments","tickets","sms","accounting","inventory","supplier","reports","users","roles","settings","hr","customers","mikrotik","packages"]',
            'invoice_footer' => 'Thank you for using our internet service.',
            'ledger_type' => 'running_balance',
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
            'customers', 'billing', 'payments', 'merchant_payments',
            'tickets', 'sms', 'accounting', 'inventory', 'hr',
            'supplier', 'reports', 'settings', 'users', 'roles',
            'mikrotik', 'packages',
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
            $staffModules = ['customers', 'billing', 'payments', 'merchant_payments', 'tickets', 'sms', 'packages'];
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

        // Technician → view customers, tickets, mikrotik + create/edit tickets
        if (isset($roles['Technician'])) {
            foreach ($permissionIds as $key => $permId) {
                [$mod, $act] = explode('.', $key);
                if (($mod === 'customers' && $act === 'view') ||
                    ($mod === 'tickets') ||
                    ($mod === 'mikrotik') ||
                    ($mod === 'reports' && $act === 'view')) {
                    \App\Models\RolePermission::create([
                        'role_id' => $roles['Technician']->id,
                        'permission_id' => $permId,
                    ]);
                }
            }
        }

        // Accountant → accounting, payments, billing, expenses, reports, supplier, inventory, hr
        if (isset($roles['Accountant'])) {
            $accModules = ['accounting', 'payments', 'billing', 'merchant_payments', 'reports', 'supplier', 'inventory', 'hr'];
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
}

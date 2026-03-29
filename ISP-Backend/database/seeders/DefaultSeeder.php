<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\GeneralSetting;
use App\Models\Package;
use App\Models\Permission;
use App\Models\Profile as User;
use App\Models\SmsSetting;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DefaultSeeder extends Seeder
{
    public function run(): void
    {
        // ── Super Admin ──────────────────────────────────
        $adminId = Str::uuid()->toString();
        User::firstOrCreate(
            ['username' => 'admin'],
            [
                'id' => $adminId,
                'full_name' => 'Super Admin',
                'email' => 'admin@smartisp.com',
                'password_hash' => Hash::make('admin123'),
                'status' => 'active',
            ]
        );
        $admin = User::where('username', 'admin')->first();
        UserRole::firstOrCreate(
            ['user_id' => $admin->id],
            ['role' => 'super_admin']
        );

        // Admin User: ismail
        $ismailId = Str::uuid()->toString();
        User::firstOrCreate(
            ['username' => 'ismail'],
            [
                'id' => $ismailId,
                'full_name' => 'Ismail',
                'email' => 'ismail@smartisp.com',
                'password_hash' => Hash::make('Admin@123'),
                'status' => 'active',
            ]
        );
        $ismail = User::where('username', 'ismail')->first();
        UserRole::firstOrCreate(
            ['user_id' => $ismail->id],
            ['role' => 'super_admin']
        );

        // ── General Settings ─────────────────────────────
        if (GeneralSetting::count() === 0) {
            GeneralSetting::create([
                'site_name' => 'Smart ISP',
                'primary_color' => '#3B82F6',
            ]);
        }

        // ── SMS Settings ─────────────────────────────────
        if (SmsSetting::count() === 0) {
            SmsSetting::create([
                'sms_on_bill_generate' => true,
                'sms_on_payment' => true,
                'sms_on_registration' => true,
                'sms_on_suspension' => true,
            ]);
        }

        // ── Default Packages ─────────────────────────────
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

        // ── Default Chart of Accounts (with hierarchy) ────
        if (Account::count() === 0) {
            $assets = Account::create(['name' => 'Assets', 'type' => 'asset', 'code' => '1000', 'is_system' => true, 'level' => 0]);
            $liabilities = Account::create(['name' => 'Liabilities', 'type' => 'liability', 'code' => '2000', 'is_system' => true, 'level' => 0]);
            $income = Account::create(['name' => 'Income', 'type' => 'income', 'code' => '4000', 'is_system' => true, 'level' => 0]);
            $expenses = Account::create(['name' => 'Expenses', 'type' => 'expense', 'code' => '5000', 'is_system' => true, 'level' => 0]);
            $equity = Account::create(['name' => 'Equity', 'type' => 'equity', 'code' => '3000', 'is_system' => true, 'level' => 0]);

            // Asset children
            Account::create(['name' => 'Cash', 'type' => 'asset', 'code' => '1001', 'parent_id' => $assets->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'Bank Account', 'type' => 'asset', 'code' => '1002', 'parent_id' => $assets->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'bKash', 'type' => 'asset', 'code' => '1003', 'parent_id' => $assets->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'Nagad', 'type' => 'asset', 'code' => '1004', 'parent_id' => $assets->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'Accounts Receivable', 'type' => 'asset', 'code' => '1100', 'parent_id' => $assets->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'Inventory', 'type' => 'asset', 'code' => '1200', 'parent_id' => $assets->id, 'level' => 1, 'is_system' => true]);

            // Liability children
            Account::create(['name' => 'Accounts Payable', 'type' => 'liability', 'code' => '2001', 'parent_id' => $liabilities->id, 'level' => 1, 'is_system' => true]);

            // Income children
            Account::create(['name' => 'ISP Billing Revenue', 'type' => 'income', 'code' => '4001', 'parent_id' => $income->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'Product Sales', 'type' => 'income', 'code' => '4002', 'parent_id' => $income->id, 'level' => 1, 'is_system' => true]);

            // Expense children
            Account::create(['name' => 'Cost of Goods Sold', 'type' => 'expense', 'code' => '5001', 'parent_id' => $expenses->id, 'level' => 1, 'is_system' => true]);
            Account::create(['name' => 'Salary Expense', 'type' => 'expense', 'code' => '5002', 'parent_id' => $expenses->id, 'level' => 1]);
            Account::create(['name' => 'Utility Expense', 'type' => 'expense', 'code' => '5003', 'parent_id' => $expenses->id, 'level' => 1]);
            Account::create(['name' => 'Office Expense', 'type' => 'expense', 'code' => '5004', 'parent_id' => $expenses->id, 'level' => 1]);

            // Equity children
            Account::create(['name' => 'Owner Equity', 'type' => 'equity', 'code' => '3001', 'parent_id' => $equity->id, 'level' => 1]);
            Account::create(['name' => 'Retained Earnings', 'type' => 'equity', 'code' => '3002', 'parent_id' => $equity->id, 'level' => 1]);
        }

        // ── Default Permissions (matching frontend modules) ──
        $modules = [
            'customers'         => ['view', 'create', 'edit', 'delete'],
            'billing'           => ['view', 'create', 'edit', 'delete'],
            'payments'          => ['view', 'create', 'edit', 'delete'],
            'merchant_payments' => ['view', 'create', 'edit', 'delete'],
            'tickets'           => ['view', 'create', 'edit', 'delete'],
            'sms'               => ['view', 'create', 'edit', 'delete'],
            'accounting'        => ['view', 'create', 'edit', 'delete'],
            'inventory'         => ['view', 'create', 'edit', 'delete'],
            'hr'                => ['view', 'create', 'edit', 'delete'],
            'supplier'          => ['view', 'create', 'edit', 'delete'],
            'reports'           => ['view', 'create', 'edit', 'delete'],
            'settings'          => ['view', 'create', 'edit', 'delete'],
            'users'             => ['view', 'create', 'edit', 'delete'],
            'roles'             => ['view', 'create', 'edit', 'delete'],
        ];

        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(
                    ['module' => $module, 'action' => $action],
                    ['description' => ucfirst($action) . ' ' . str_replace('_', ' ', $module)]
                );
            }
        }

        $this->command->info('Default data seeded!');
        $this->command->info('Admin #1 → username: admin / password: admin123');
        $this->command->info('Admin #2 → username: ismail / password: Admin@123');
        $this->command->info('Chart of Accounts with hierarchy created (5 root + children).');
        $this->command->info('All module permissions seeded (14 modules × 4 actions = 56 permissions).');
    }
}

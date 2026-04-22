<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * Seeds the standard Chart-of-Accounts entries that the Wallet + Settlement
 * modules rely on. Idempotent — uses firstOrCreate per tenant so reruns are safe.
 *
 * Required codes:
 *   1001 — Cash on hand            (asset)
 *   2050 — Wallet Liability        (liability)
 *   4001 — Bill Revenue            (revenue)
 *   5001 — Salary Expense          (expense)
 *   2100 — Employee Payable        (liability)
 *   1300 — Employee Advance        (asset)
 *
 * Does NOT modify integration tables (sms_*, payment_gateways, mikrotik_*).
 */
class WalletCoaSeeder extends Seeder
{
    public function run(): void
    {
        if (!Schema::hasTable('accounts')) {
            $this->command?->warn('accounts table missing — skipping COA seed');
            return;
        }

        $coa = [
            ['code' => '1001', 'name' => 'Cash on hand',     'type' => 'asset'],
            ['code' => '2050', 'name' => 'Wallet Liability', 'type' => 'liability'],
            ['code' => '4001', 'name' => 'Bill Revenue',     'type' => 'revenue'],
            ['code' => '5001', 'name' => 'Salary Expense',   'type' => 'expense'],
            ['code' => '2100', 'name' => 'Employee Payable', 'type' => 'liability'],
            ['code' => '1300', 'name' => 'Employee Advance', 'type' => 'asset'],
        ];

        $tenantIds = Schema::hasTable('tenants')
            ? Tenant::query()->pluck('id')->push(null)->unique()->values()
            : collect([null]);

        foreach ($tenantIds as $tenantId) {
            foreach ($coa as $row) {
                Account::firstOrCreate(
                    ['code' => $row['code'], 'tenant_id' => $tenantId],
                    [
                        'name'      => $row['name'],
                        'type'      => $row['type'],
                        'status'    => 'active',
                        'is_system' => true,
                    ]
                );
            }
        }

        $this->command?->info('Wallet/Settlement COA seeded for '.$tenantIds->count().' tenant scopes.');
    }
}

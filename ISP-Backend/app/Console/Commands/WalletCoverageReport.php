<?php

namespace App\Console\Commands;

use App\Models\Account;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * v1.17.2 — Wallet/Settlement seeder coverage report.
 *
 * Lists tenants that are missing one or more required Chart-of-Accounts entries
 * needed by the Wallet + Settlement modules. Read-only; safe to run anytime.
 *
 * Usage:
 *   php artisan wallet:coverage
 *   php artisan wallet:coverage --json
 *   php artisan wallet:coverage --fix    (re-run idempotent COA seeder for missing tenants)
 *
 * Does NOT modify integration tables (mikrotik_*, sms_*, payment_gateways, email_configs).
 */
class WalletCoverageReport extends Command
{
    protected $signature = 'wallet:coverage {--json : Output JSON for scripting} {--fix : Auto-create missing COA via seeder}';
    protected $description = 'Report tenants missing required wallet/settlement COA accounts (v1.17.2)';

    /** Required system accounts seeded by WalletCoaSeeder. */
    private array $required = [
        '1001' => 'Cash on hand',
        '2050' => 'Wallet Liability',
        '4001' => 'Bill Revenue',
        '5001' => 'Salary Expense',
        '2100' => 'Employee Payable',
        '1300' => 'Employee Advance',
    ];

    public function handle(): int
    {
        if (!Schema::hasTable('accounts')) {
            $this->error('accounts table missing — run migrations first.');
            return self::FAILURE;
        }

        $tenantIds = Schema::hasTable('tenants')
            ? Tenant::query()->pluck('id', 'id')->prepend('Global (no tenant)', null)->all()
            : [null => 'Global (no tenant)'];

        $report = [];
        foreach ($tenantIds as $tid => $label) {
            $present = Account::query()
                ->when($tid, fn($q) => $q->where('tenant_id', $tid), fn($q) => $q->whereNull('tenant_id'))
                ->whereIn('code', array_keys($this->required))
                ->pluck('code')
                ->all();

            $missing = array_diff(array_keys($this->required), $present);
            $report[] = [
                'tenant_id' => $tid,
                'label'     => is_string($label) ? $label : (string) $tid,
                'missing'   => array_values($missing),
                'ok'        => empty($missing),
            ];
        }

        $bad = array_values(array_filter($report, fn($r) => !$r['ok']));

        if ($this->option('json')) {
            $this->line(json_encode([
                'version'      => 'v1.17.2',
                'checked_at'   => now()->toIso8601String(),
                'total'        => count($report),
                'incomplete'   => count($bad),
                'tenants'      => $report,
            ], JSON_PRETTY_PRINT));
            return $bad ? self::FAILURE : self::SUCCESS;
        }

        $this->info("Wallet COA Coverage — v1.17.2");
        $this->line("Checked ".count($report)." tenant scope(s). Incomplete: ".count($bad));
        $this->newLine();

        if (empty($bad)) {
            $this->info('✓ All tenants have the required wallet/settlement COA rows.');
            return self::SUCCESS;
        }

        $this->table(
            ['Tenant', 'Missing codes'],
            array_map(fn($r) => [$r['label'], implode(', ', $r['missing'])], $bad)
        );

        if ($this->option('fix')) {
            $this->warn('Re-running WalletCoaSeeder to backfill missing accounts…');
            $this->call('db:seed', ['--class' => 'Database\\Seeders\\WalletCoaSeeder', '--force' => true]);
            $this->info('Done. Re-run `php artisan wallet:coverage` to verify.');
        } else {
            $this->warn('Run with --fix to re-seed missing accounts (idempotent).');
        }

        return self::FAILURE;
    }
}

<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\DB;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     */
    protected $commands = [
        Commands\GenerateBills::class,
        Commands\AutoSuspend::class,
        Commands\CleanupSessions::class,
        Commands\CalculateDailyProfit::class,
        Commands\SendBillReminders::class,
        Commands\ScanModules::class,
        Commands\TenantSetup::class,
    ];

    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // ── ISP Billing ──────────────────────────────────
        $schedule->command('bills:generate')->monthlyOn(1, '00:00');
        $schedule->command('customers:auto-suspend --days=7')->dailyAt('02:00');
        $schedule->command('bills:send-reminders')->dailyAt('09:00');

        // ── Sessions ─────────────────────────────────────
        $schedule->command('sessions:cleanup')->hourly();

        // ── Accounting / Reports ─────────────────────────
        $schedule->command('reports:daily-profit')->dailyAt('23:55');

        // ── Auto Backup (respects system_settings) ──────
        // Only run the frequency that matches the saved setting
        $schedule->call(function () {
            $this->runAutoBackupIfEnabled();
        })->dailyAt('02:30');
    }

    /**
     * Run auto backup only if enabled and matching the configured frequency.
     */
    private function runAutoBackupIfEnabled(): void
    {
        try {
            $settings = DB::table('system_settings')
                ->whereIn('setting_key', ['auto_backup_enabled', 'auto_backup_frequency'])
                ->pluck('setting_value', 'setting_key');

            $enabled = ($settings['auto_backup_enabled'] ?? 'false') === 'true';
            if (!$enabled) return;

            $frequency = $settings['auto_backup_frequency'] ?? 'daily';
            $now = now();

            $shouldRun = match ($frequency) {
                'daily' => true,
                'weekly' => $now->dayOfWeek === 0, // Sunday
                'monthly' => $now->day === 1,
                default => false,
            };

            if ($shouldRun) {
                \Artisan::call('backup:auto', ['--type' => 'full']);
            }
        } catch (\Exception $e) {
            report($e);
        }
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');

        require base_path('routes/console.php');
    }
}

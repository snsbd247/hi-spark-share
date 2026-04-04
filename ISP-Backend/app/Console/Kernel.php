<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

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
        // Generate monthly bills on 1st of each month at midnight
        $schedule->command('bills:generate')->monthlyOn(1, '00:00');

        // Auto-suspend customers with overdue bills (7+ days) every day at 2 AM
        $schedule->command('customers:auto-suspend --days=7')->dailyAt('02:00');

        // Send bill reminders daily at 9 AM
        $schedule->command('bills:send-reminders')->dailyAt('09:00');

        // ── Sessions ─────────────────────────────────────
        // Cleanup expired sessions every hour
        $schedule->command('sessions:cleanup')->hourly();

        // ── Accounting / Reports ─────────────────────────
        // Calculate daily profit at end of day (11:55 PM)
        $schedule->command('reports:daily-profit')->dailyAt('23:55');

        // ── Auto Backup ──────────────────────────────────
        // Daily auto backup at 2:30 AM
        $schedule->command('backup:auto')->dailyAt('02:30');
        // Weekly full backup on Sunday at 3 AM
        $schedule->command('backup:auto')->weeklyOn(0, '03:00');
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

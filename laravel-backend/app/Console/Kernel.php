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
    ];

    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Generate monthly bills on 1st of each month at midnight
        $schedule->command('bills:generate')->monthlyOn(1, '00:00');

        // Auto-suspend customers with overdue bills (7+ days) every day at 2 AM
        $schedule->command('customers:auto-suspend --days=7')->dailyAt('02:00');

        // Cleanup expired sessions every hour
        $schedule->command('sessions:cleanup')->hourly();
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

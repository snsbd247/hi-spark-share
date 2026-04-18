<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Phase 9 — Retention pruner for onu_signal_history.
 * Default retention: 30 days. Run daily via scheduler.
 */
class PruneOnuSignalHistory extends Command
{
    protected $signature = 'fiber:prune-signal-history {--days=30}';
    protected $description = 'Prune onu_signal_history older than N days (default 30).';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);
        try {
            $deleted = DB::table('onu_signal_history')->where('recorded_at', '<', $cutoff)->delete();
            $this->info("Pruned {$deleted} signal history rows older than {$days}d.");
        } catch (\Throwable $e) {
            $this->warn('Prune skipped: ' . $e->getMessage());
        }
        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Services\FullBackupService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoBackup extends Command
{
    protected $signature = 'backup:auto {--type=full : Backup type (full)}';
    protected $description = 'Run automated system backup';

    public function handle(FullBackupService $service): int
    {
        // Check if auto backup is enabled
        $enabled = DB::table('system_settings')
            ->where('setting_key', 'auto_backup_enabled')
            ->value('setting_value');

        if ($enabled !== 'true') {
            $this->info('Auto backup is disabled. Skipping.');
            return 0;
        }

        $this->info('Starting auto backup...');

        try {
            $result = $service->create('auto_scheduler');
            $this->info("Backup created: {$result['file_name']} ({$result['size']} bytes)");

            // Cleanup old backups based on keep_count
            $keepCount = (int) DB::table('system_settings')
                ->where('setting_key', 'auto_backup_keep_count')
                ->value('setting_value') ?: 10;

            $this->cleanupOldBackups($keepCount);

            return 0;
        } catch (\Exception $e) {
            $this->error("Backup failed: {$e->getMessage()}");
            Log::error('Auto backup failed', ['error' => $e->getMessage()]);
            return 1;
        }
    }

    private function cleanupOldBackups(int $keepCount): void
    {
        $dir = storage_path('app/backups/full');
        if (!is_dir($dir)) return;

        $files = glob("{$dir}/*.sql");
        usort($files, fn($a, $b) => filemtime($b) - filemtime($a));

        $toDelete = array_slice($files, $keepCount);
        foreach ($toDelete as $file) {
            unlink($file);
            DB::table('backup_logs')
                ->where('file_name', basename($file))
                ->delete();
        }

        if (count($toDelete) > 0) {
            $this->info("Cleaned up " . count($toDelete) . " old backups.");
        }
    }
}

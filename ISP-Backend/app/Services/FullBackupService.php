<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class FullBackupService
{
    /**
     * Create a full SQL backup of the entire database.
     */
    public function create(string $createdBy = 'system'): array
    {
        $tables = $this->getAllTables();
        $sql = "-- Smart ISP Full Backup\n";
        $sql .= "-- Generated: " . now()->toIso8601String() . "\n";
        $sql .= "-- Type: full\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        foreach ($tables as $table) {
            $sql .= $this->exportTable($table);
        }

        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

        $fileName = 'full_backup_' . now()->format('Y_m_d_His') . '.sql';
        $dir = storage_path('app/backups/full');
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $filePath = "{$dir}/{$fileName}";
        file_put_contents($filePath, $sql);

        // Log
        DB::table('backup_logs')->insert([
            'id' => Str::uuid()->toString(),
            'file_name' => $fileName,
            'file_size' => filesize($filePath),
            'backup_type' => 'full',
            'status' => 'completed',
            'created_by' => $createdBy,
            'created_at' => now(),
        ]);

        return [
            'file_name' => $fileName,
            'file_path' => "backups/full/{$fileName}",
            'size' => filesize($filePath),
        ];
    }

    /**
     * Restore from a full SQL backup file path.
     */
    public function restore(string $filePath): void
    {
        $fullPath = storage_path("app/{$filePath}");
        if (!file_exists($fullPath)) {
            throw new \Exception("Backup file not found: {$filePath}");
        }

        $sql = file_get_contents($fullPath);
        DB::unprepared($sql);
    }

    /**
     * Verify backup file integrity.
     */
    public function verify(string $filePath): array
    {
        $fullPath = storage_path("app/{$filePath}");
        if (!file_exists($fullPath)) {
            return ['valid' => false, 'error' => 'File not found'];
        }

        $content = file_get_contents($fullPath);
        $hasHeader = str_contains($content, '-- Smart ISP');
        $hasInserts = str_contains($content, 'INSERT INTO');
        $size = filesize($fullPath);

        return [
            'valid' => $hasHeader && $size > 100,
            'has_header' => $hasHeader,
            'has_data' => $hasInserts,
            'size' => $size,
            'lines' => substr_count($content, "\n"),
        ];
    }

    private function exportTable(string $table): string
    {
        $rows = DB::table($table)->get();
        if ($rows->isEmpty()) return "-- Table `{$table}`: empty\n\n";

        $sql = "-- Table: {$table} ({$rows->count()} rows)\n";
        $sql .= "TRUNCATE TABLE `{$table}`;\n";

        foreach ($rows as $row) {
            $data = (array) $row;
            $cols = implode('`, `', array_keys($data));
            $vals = implode(', ', array_map(function ($v) {
                if ($v === null) return 'NULL';
                return "'" . addslashes((string) $v) . "'";
            }, array_values($data)));
            $sql .= "INSERT INTO `{$table}` (`{$cols}`) VALUES ({$vals});\n";
        }

        return $sql . "\n";
    }

    private function getAllTables(): array
    {
        $exclude = [
            'migrations', 'personal_access_tokens', 'password_reset_tokens',
            'failed_jobs', 'cache', 'cache_locks', 'sessions', 'jobs', 'job_batches',
        ];
        return array_values(array_diff(Schema::getTableListing(), $exclude));
    }
}

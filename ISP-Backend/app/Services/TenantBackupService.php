<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class TenantBackupService
{
    /**
     * Tables that contain tenant-scoped data (have tenant_id column).
     */
    private function getTenantTables(): array
    {
        $allTables = Schema::getTableListing();
        $tenantTables = [];

        foreach ($allTables as $table) {
            if (Schema::hasColumn($table, 'tenant_id')) {
                $tenantTables[] = $table;
            }
        }

        return $tenantTables;
    }

    /**
     * Create a tenant-specific SQL backup.
     */
    public function create(string $tenantId, string $createdBy = 'system'): array
    {
        $tenant = DB::table('tenants')->where('id', $tenantId)->first();
        if (!$tenant) {
            throw new \Exception("Tenant not found: {$tenantId}");
        }

        $tables = $this->getTenantTables();
        $sql = "-- Smart ISP Tenant Backup\n";
        $sql .= "-- Tenant: {$tenant->name} ({$tenantId})\n";
        $sql .= "-- Generated: " . now()->toIso8601String() . "\n";
        $sql .= "-- Type: tenant\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        $totalRows = 0;

        foreach ($tables as $table) {
            $rows = DB::table($table)->where('tenant_id', $tenantId)->get();
            if ($rows->isEmpty()) continue;

            $totalRows += $rows->count();
            $sql .= "-- Table: {$table} ({$rows->count()} rows)\n";
            $sql .= "DELETE FROM `{$table}` WHERE `tenant_id` = '{$tenantId}';\n";

            foreach ($rows as $row) {
                $data = (array) $row;
                $cols = implode('`, `', array_keys($data));
                $vals = implode(', ', array_map(function ($v) {
                    if ($v === null) return 'NULL';
                    return "'" . addslashes((string) $v) . "'";
                }, array_values($data)));
                $sql .= "INSERT INTO `{$table}` (`{$cols}`) VALUES ({$vals});\n";
            }
            $sql .= "\n";
        }

        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

        $dir = storage_path("app/backups/tenants/{$tenantId}");
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $fileName = "tenant_{$tenantId}_backup_" . now()->format('Y_m_d_His') . '.sql';
        $filePath = "{$dir}/{$fileName}";
        file_put_contents($filePath, $sql);

        DB::table('backup_logs')->insert([
            'id' => Str::uuid()->toString(),
            'file_name' => $fileName,
            'file_size' => filesize($filePath),
            'backup_type' => 'tenant',
            'status' => 'completed',
            'created_by' => $createdBy,
            'created_at' => now(),
        ]);

        return [
            'file_name' => $fileName,
            'file_path' => "backups/tenants/{$tenantId}/{$fileName}",
            'size' => filesize($filePath),
            'total_rows' => $totalRows,
            'tenant_name' => $tenant->name,
        ];
    }

    /**
     * Restore a tenant backup.
     */
    public function restore(string $tenantId, string $filePath): void
    {
        $fullPath = storage_path("app/{$filePath}");
        if (!file_exists($fullPath)) {
            throw new \Exception("Backup file not found: {$filePath}");
        }

        $sql = file_get_contents($fullPath);

        // Validate this is actually for the correct tenant
        if (!str_contains($sql, $tenantId)) {
            throw new \Exception("Backup file does not belong to tenant: {$tenantId}");
        }

        DB::beginTransaction();
        try {
            DB::unprepared($sql);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

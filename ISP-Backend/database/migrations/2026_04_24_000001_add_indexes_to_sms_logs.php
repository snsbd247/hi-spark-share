<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * v1.17.5 — Performance indexes for SMS History queries.
 *
 * Adds composite + single-column indexes used by:
 *   - Tenant SMS history (tenant_id + created_at desc)
 *   - Super Admin SMS history (status, phone, created_at)
 *
 * Idempotent: uses information_schema check so reruns are safe.
 * No data is altered. Pure index DDL.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('sms_logs')) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        $existing = $this->existingIndexes('sms_logs', $driver);

        Schema::table('sms_logs', function (Blueprint $table) use ($existing) {
            if (!in_array('sms_logs_tenant_created_idx', $existing, true)) {
                $table->index(['tenant_id', 'created_at'], 'sms_logs_tenant_created_idx');
            }
            if (!in_array('sms_logs_created_at_idx', $existing, true)) {
                $table->index('created_at', 'sms_logs_created_at_idx');
            }
            if (!in_array('sms_logs_status_idx', $existing, true)) {
                $table->index('status', 'sms_logs_status_idx');
            }
            if (!in_array('sms_logs_phone_idx', $existing, true)) {
                $table->index('phone', 'sms_logs_phone_idx');
            }
            if (!in_array('sms_logs_sms_type_idx', $existing, true)) {
                $table->index('sms_type', 'sms_logs_sms_type_idx');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('sms_logs')) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        $existing = $this->existingIndexes('sms_logs', $driver);

        Schema::table('sms_logs', function (Blueprint $table) use ($existing) {
            foreach ([
                'sms_logs_tenant_created_idx',
                'sms_logs_created_at_idx',
                'sms_logs_status_idx',
                'sms_logs_phone_idx',
                'sms_logs_sms_type_idx',
            ] as $idx) {
                if (in_array($idx, $existing, true)) {
                    $table->dropIndex($idx);
                }
            }
        });
    }

    private function existingIndexes(string $table, string $driver): array
    {
        try {
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $rows = DB::select("SHOW INDEX FROM `{$table}`");
                return array_values(array_unique(array_map(fn ($r) => $r->Key_name, $rows)));
            }
            if ($driver === 'pgsql') {
                $rows = DB::select(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = ?",
                    [$table]
                );
                return array_map(fn ($r) => $r->indexname, $rows);
            }
        } catch (\Throwable $e) {
            // Fall through; treat as no indexes known.
        }
        return [];
    }
};

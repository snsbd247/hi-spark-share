<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * SSOT (Single Source of Truth) Bridge — Phase 15
 *
 * Goal: eliminate duplicate OLT/ONU entries by enforcing strict 1:1 link between
 *  - fiber_olts (topology master)  ↔  olt_devices (credentials/monitoring)
 *  - fiber_onus (topology master)  ↔  onu_live_status (live signal)
 *
 * NON-DESTRUCTIVE: only adds columns/indexes, no data drop.
 */
return new class extends Migration {
    public function up(): void
    {
        // 1) olt_devices.fiber_olt_id — enforce 1:1 with fiber_olts
        if (Schema::hasTable('olt_devices')) {
            Schema::table('olt_devices', function (Blueprint $table) {
                if (!Schema::hasColumn('olt_devices', 'fiber_olt_id')) {
                    $table->uuid('fiber_olt_id')->nullable()->after('tenant_id');
                }
            });

            // Add UNIQUE only when no duplicates exist (safe re-run)
            $dupes = DB::table('olt_devices')
                ->whereNotNull('fiber_olt_id')
                ->select('fiber_olt_id', DB::raw('COUNT(*) as c'))
                ->groupBy('fiber_olt_id')
                ->having('c', '>', 1)
                ->count();

            if ($dupes === 0) {
                try {
                    Schema::table('olt_devices', function (Blueprint $table) {
                        $table->unique('fiber_olt_id', 'olt_devices_fiber_olt_id_unique');
                    });
                } catch (\Throwable $e) { /* index may already exist */ }
            }
        }

        // 2) fiber_onus — add SSOT link columns to live monitoring side
        if (Schema::hasTable('fiber_onus')) {
            Schema::table('fiber_onus', function (Blueprint $table) {
                if (!Schema::hasColumn('fiber_onus', 'olt_device_id')) {
                    $table->uuid('olt_device_id')->nullable()->after('splitter_output_id')->index();
                }
                if (!Schema::hasColumn('fiber_onus', 'pon_port_id')) {
                    $table->uuid('pon_port_id')->nullable()->after('olt_device_id')->index();
                }
                if (!Schema::hasColumn('fiber_onus', 'is_unlinked')) {
                    // true = ONU discovered via poll but not yet placed on topology splitter
                    $table->boolean('is_unlinked')->default(false)->index();
                }
                if (!Schema::hasColumn('fiber_onus', 'discovered_at')) {
                    $table->timestamp('discovered_at')->nullable();
                }
            });

            // Per-tenant unique on serial_number (only if no duplicates)
            $serialDupes = DB::table('fiber_onus')
                ->select('tenant_id', 'serial_number', DB::raw('COUNT(*) as c'))
                ->groupBy('tenant_id', 'serial_number')
                ->having('c', '>', 1)
                ->count();

            if ($serialDupes === 0) {
                try {
                    Schema::table('fiber_onus', function (Blueprint $table) {
                        $table->unique(['tenant_id', 'serial_number'], 'fiber_onus_tenant_serial_unique');
                    });
                } catch (\Throwable $e) { /* exists */ }
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('olt_devices')) {
            try {
                Schema::table('olt_devices', function (Blueprint $table) {
                    $table->dropUnique('olt_devices_fiber_olt_id_unique');
                });
            } catch (\Throwable $e) {}
        }
        if (Schema::hasTable('fiber_onus')) {
            try {
                Schema::table('fiber_onus', function (Blueprint $table) {
                    $table->dropUnique('fiber_onus_tenant_serial_unique');
                });
            } catch (\Throwable $e) {}
            Schema::table('fiber_onus', function (Blueprint $table) {
                if (Schema::hasColumn('fiber_onus', 'discovered_at')) $table->dropColumn('discovered_at');
                if (Schema::hasColumn('fiber_onus', 'is_unlinked')) $table->dropColumn('is_unlinked');
                if (Schema::hasColumn('fiber_onus', 'pon_port_id')) $table->dropColumn('pon_port_id');
                if (Schema::hasColumn('fiber_onus', 'olt_device_id')) $table->dropColumn('olt_device_id');
            });
        }
    }
};

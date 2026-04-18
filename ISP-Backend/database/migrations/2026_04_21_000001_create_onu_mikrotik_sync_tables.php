<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Per-tenant feature flag — adds column to onu_alert_rules (re-uses tenant scoping).
        // Standalone tenant_settings row would also work, but coupling to a rule allows
        // event-specific control (e.g. only suspend on LOS, not on signal_low).
        if (Schema::hasTable('onu_alert_rules') && !Schema::hasColumn('onu_alert_rules', 'auto_suspend_pppoe')) {
            Schema::table('onu_alert_rules', function (Blueprint $table) {
                $table->boolean('auto_suspend_pppoe')->default(false)->after('is_active');
            });
        }

        if (!Schema::hasTable('onu_mikrotik_sync_logs')) {
            Schema::create('onu_mikrotik_sync_logs', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->nullable()->index();
                $table->uuid('customer_id')->nullable()->index();
                $table->uuid('olt_device_id')->nullable()->index();
                $table->string('serial_number')->index();
                $table->string('pppoe_username')->nullable();
                $table->string('action');           // disable | enable
                $table->string('trigger_event');    // offline | los | dying_gasp | recovered
                $table->string('previous_status')->nullable();
                $table->string('current_status');
                $table->boolean('success')->default(false);
                $table->text('message')->nullable();
                $table->timestamp('executed_at')->useCurrent();
                $table->index(['serial_number', 'executed_at']);
            });
        }

        // Track auto-suspended customers so we know who to auto-restore.
        if (Schema::hasTable('customers') && !Schema::hasColumn('customers', 'auto_suspended_by_onu')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->boolean('auto_suspended_by_onu')->default(false)->after('mikrotik_sync_status');
                $table->timestamp('auto_suspended_at')->nullable()->after('auto_suspended_by_onu');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('onu_mikrotik_sync_logs');
        if (Schema::hasTable('onu_alert_rules') && Schema::hasColumn('onu_alert_rules', 'auto_suspend_pppoe')) {
            Schema::table('onu_alert_rules', fn(Blueprint $t) => $t->dropColumn('auto_suspend_pppoe'));
        }
        if (Schema::hasTable('customers') && Schema::hasColumn('customers', 'auto_suspended_by_onu')) {
            Schema::table('customers', function (Blueprint $t) {
                $t->dropColumn(['auto_suspended_by_onu', 'auto_suspended_at']);
            });
        }
    }
};

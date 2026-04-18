<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Live OLT + ONU Monitoring — extension of Fiber Topology.
 * NEW tables only. Does NOT touch any existing table or integration.
 */
return new class extends Migration {
    public function up(): void
    {
        // OLT device credentials & connection metadata
        Schema::create('olt_devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('fiber_olt_id')->nullable()->index(); // optional link to existing fiber_olts row
            $table->string('name');
            $table->string('ip_address');
            $table->integer('port')->default(22);
            $table->integer('api_port')->nullable();
            $table->string('username')->nullable();
            $table->text('password_encrypted')->nullable();
            $table->string('encryption_key_id')->nullable(); // for key-rotation support
            $table->string('vendor')->default('huawei'); // huawei | zte | vsol | bdcom
            $table->string('connection_type')->default('cli'); // api | cli | hybrid
            $table->string('status')->default('unknown'); // online | offline | unknown
            $table->integer('poll_interval_sec')->default(300);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_polled_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        // Per-ONU live signal & status (one row per ONU, upserted on each poll)
        Schema::create('onu_live_status', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('onu_id')->nullable()->index(); // ref fiber_onus.id (loose)
            $table->uuid('olt_device_id')->nullable()->index();
            $table->string('serial_number')->nullable()->index();
            $table->string('status')->default('unknown'); // online | offline | los | dying-gasp | unknown
            $table->float('rx_power')->nullable(); // dBm (ONU side)
            $table->float('tx_power')->nullable(); // dBm
            $table->float('olt_rx_power')->nullable(); // dBm (OLT receives from ONU)
            $table->string('uptime')->nullable();
            $table->integer('distance_m')->nullable();
            $table->string('last_down_reason')->nullable();
            $table->timestamp('last_seen')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['olt_device_id', 'serial_number'], 'onu_live_olt_sn_unique');
        });

        // Polling logs (audit + debugging) — append-only, masked credentials
        Schema::create('olt_polling_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('olt_device_id')->nullable()->index();
            $table->string('connection_mode')->nullable(); // api | cli
            $table->string('command')->nullable();
            $table->string('status')->default('ok'); // ok | error | timeout
            $table->integer('duration_ms')->nullable();
            $table->integer('onu_count')->nullable();
            $table->text('response')->nullable(); // truncated, masked
            $table->text('error_message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['olt_device_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('olt_polling_logs');
        Schema::dropIfExists('onu_live_status');
        Schema::dropIfExists('olt_devices');
    }
};

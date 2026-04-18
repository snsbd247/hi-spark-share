<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 9 — Historical signal trend storage.
 * Append-only time-series for ONU rx/tx/olt_rx power.
 * Isolated, additive — does NOT touch existing tables.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('onu_signal_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('olt_device_id')->nullable()->index();
            $table->string('serial_number')->index();
            $table->float('rx_power')->nullable();
            $table->float('tx_power')->nullable();
            $table->float('olt_rx_power')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('recorded_at')->useCurrent();
            $table->index(['serial_number', 'recorded_at'], 'onu_sig_sn_time_idx');
            $table->index(['olt_device_id', 'recorded_at'], 'onu_sig_olt_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('onu_signal_history');
    }
};

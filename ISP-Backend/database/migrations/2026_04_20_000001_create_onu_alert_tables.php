<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 10 — Alert Engine.
 * Tenant-scoped alert rules + dispatch logs. Additive, isolated.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('onu_alert_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('name');
            $table->string('event_type'); // offline | los | dying_gasp | signal_low | any
            $table->float('rx_threshold_db')->nullable(); // for signal_low
            $table->unsignedInteger('cooldown_minutes')->default(30);
            $table->json('recipients_email')->nullable();
            $table->json('recipients_sms')->nullable();
            $table->json('channels')->nullable(); // ["email","sms"]
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['tenant_id', 'event_type', 'is_active'], 'onu_alert_rules_lookup_idx');
        });

        Schema::create('onu_alert_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('rule_id')->nullable()->index();
            $table->uuid('olt_device_id')->nullable()->index();
            $table->string('serial_number')->index();
            $table->string('event_type');
            $table->string('previous_status')->nullable();
            $table->string('current_status')->nullable();
            $table->float('rx_power')->nullable();
            $table->text('message')->nullable();
            $table->json('channels_sent')->nullable(); // {email:true,sms:false,...}
            $table->json('errors')->nullable();
            $table->timestamp('sent_at')->useCurrent();
            $table->index(['serial_number', 'event_type', 'sent_at'], 'onu_alert_logs_dedupe_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('onu_alert_logs');
        Schema::dropIfExists('onu_alert_rules');
    }
};

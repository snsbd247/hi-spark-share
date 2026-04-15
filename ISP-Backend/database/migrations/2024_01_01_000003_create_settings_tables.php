<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('general_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('site_name')->default('Smart ISP APP');
            $table->string('logo_url')->nullable();
            $table->string('login_logo_url')->nullable();
            $table->string('favicon_url')->nullable();
            $table->string('primary_color')->nullable();
            $table->string('email')->nullable();
            $table->string('mobile')->nullable();
            $table->text('address')->nullable();
            $table->string('support_email')->nullable();
            $table->string('support_phone')->nullable();
            $table->timestamps();
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('setting_key');
            $table->text('setting_value')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'setting_key']);
        });

        Schema::create('payment_gateways', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('gateway_name')->default('bkash');
            $table->string('environment')->default('sandbox');
            $table->string('status')->default('inactive');
            $table->string('app_key')->nullable();
            $table->string('app_secret')->nullable();
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->string('merchant_number')->nullable();
            $table->string('base_url')->nullable();
            $table->uuid('receiving_account_id')->nullable()->index();
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamps();
        });

        Schema::create('smtp_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('host')->nullable();
            $table->integer('port')->default(587);
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->string('encryption')->default('tls');
            $table->string('from_email')->nullable();
            $table->string('from_name')->nullable();
            $table->string('status')->default('inactive');
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('admin_id')->index();
            $table->string('admin_name')->default('System');
            $table->string('table_name');
            $table->string('record_id');
            $table->string('action');
            $table->string('module')->nullable();
            $table->json('old_data')->nullable();
            $table->json('new_data')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->uuid('user_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('backup_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('file_name');
            $table->bigInteger('file_size')->default(0);
            $table->string('backup_type')->default('manual');
            $table->string('status')->default('completed');
            $table->string('created_by');
            $table->text('error_message')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('user_id')->nullable()->index();
            $table->string('action');
            $table->string('module');
            $table->string('description');
            $table->string('ip_address')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('login_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('user_id')->nullable()->index();
            $table->string('ip_address')->nullable();
            $table->string('device')->nullable();
            $table->string('browser')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('status')->default('success');
            $table->string('failure_reason')->nullable();
            $table->string('country')->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->boolean('is_suspicious')->default(false);
            $table->string('suspicious_reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('billing_config', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('config_key');
            $table->string('config_value');
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_config');
        Schema::dropIfExists('login_histories');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('backup_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('smtp_settings');
        Schema::dropIfExists('payment_gateways');
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('general_settings');
    }
};

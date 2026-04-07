<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('resellers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('name');
            $table->string('company_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('user_id')->nullable()->unique();
            $table->string('password_hash')->nullable();
            $table->decimal('wallet_balance', 12, 2)->default(0);
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->decimal('default_commission', 12, 2)->default(0);
            $table->string('status')->default('active');
            $table->boolean('allow_all_packages')->default(true);
            $table->timestamps();
        });

        Schema::create('reseller_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id')->index();
            $table->string('session_token')->unique();
            $table->string('ip_address')->nullable();
            $table->string('browser')->nullable();
            $table->string('device_name')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('last_activity')->nullable();
            $table->timestamps();
        });

        Schema::create('reseller_packages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('reseller_id')->index();
            $table->uuid('package_id')->index();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('reseller_package_commissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id')->index();
            $table->uuid('package_id')->index();
            $table->uuid('tenant_id')->nullable()->index();
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('reseller_wallet_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id')->index();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('type')->default('debit');
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('balance_after', 12, 2)->default(0);
            $table->text('description')->nullable();
            $table->string('reference')->nullable();
            $table->timestamps();
        });

        Schema::create('reseller_commissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id')->index();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('month');
            $table->decimal('total_billing', 12, 2)->default(0);
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        Schema::create('reseller_zones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->uuid('reseller_id')->nullable()->index();
            $table->string('name');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('customer_reseller_migrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->index();
            $table->uuid('old_reseller_id')->nullable()->index();
            $table->uuid('new_reseller_id')->nullable()->index();
            $table->uuid('changed_by')->nullable();
            $table->text('reason')->nullable();
            $table->uuid('tenant_id')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('customer_bandwidth_usages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->index();
            $table->uuid('tenant_id')->index();
            $table->uuid('reseller_id')->nullable()->index();
            $table->uuid('zone_id')->nullable()->index();
            $table->date('date');
            $table->decimal('upload_mb', 12, 2)->default(0);
            $table->decimal('download_mb', 12, 2)->default(0);
            $table->decimal('total_mb', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_bandwidth_usages');
        Schema::dropIfExists('customer_reseller_migrations');
        Schema::dropIfExists('reseller_zones');
        Schema::dropIfExists('reseller_commissions');
        Schema::dropIfExists('reseller_wallet_transactions');
        Schema::dropIfExists('reseller_package_commissions');
        Schema::dropIfExists('reseller_packages');
        Schema::dropIfExists('reseller_sessions');
        Schema::dropIfExists('resellers');
    }
};

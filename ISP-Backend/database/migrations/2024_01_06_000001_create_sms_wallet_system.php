<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ── SMS Wallets ──────────────────────────────────
        if (!Schema::hasTable('sms_wallets')) {
            Schema::create('sms_wallets', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->unique();
                $table->integer('balance')->default(0);
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        // ── SMS Transactions ─────────────────────────────
        if (!Schema::hasTable('sms_transactions')) {
            Schema::create('sms_transactions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->index();
                $table->integer('amount');
                $table->string('type')->default('credit'); // credit, debit
                $table->text('description')->nullable();
                $table->string('admin_id')->nullable();
                $table->integer('balance_after')->default(0);
                $table->timestamp('created_at')->useCurrent();

                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        // ── Add tenant_id & sms_count to sms_logs ────────
        if (Schema::hasTable('sms_logs')) {
            if (!Schema::hasColumn('sms_logs', 'tenant_id')) {
                Schema::table('sms_logs', function (Blueprint $table) {
                    $table->uuid('tenant_id')->nullable()->after('customer_id');
                });
            }
            if (!Schema::hasColumn('sms_logs', 'sms_count')) {
                Schema::table('sms_logs', function (Blueprint $table) {
                    $table->integer('sms_count')->default(1)->after('tenant_id');
                });
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_transactions');
        Schema::dropIfExists('sms_wallets');

        if (Schema::hasTable('sms_logs')) {
            Schema::table('sms_logs', function (Blueprint $table) {
                if (Schema::hasColumn('sms_logs', 'tenant_id')) {
                    $table->dropColumn('tenant_id');
                }
                if (Schema::hasColumn('sms_logs', 'sms_count')) {
                    $table->dropColumn('sms_count');
                }
            });
        }
    }
};

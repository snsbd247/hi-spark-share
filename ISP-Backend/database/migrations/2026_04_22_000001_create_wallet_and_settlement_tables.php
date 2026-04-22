<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('customer_wallets')) {
            Schema::create('customer_wallets', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->nullable()->index();
                $table->uuid('customer_id');
                $table->decimal('balance', 14, 2)->default(0);
                $table->string('status')->default('active'); // active | frozen
                $table->boolean('auto_pay')->default(true);
                $table->timestamps();

                $table->unique(['tenant_id', 'customer_id'], 'cust_wallet_tenant_cust_unique');
                $table->index('customer_id');
            });
        }

        if (!Schema::hasTable('wallet_transactions')) {
            Schema::create('wallet_transactions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->nullable()->index();
                $table->uuid('customer_id')->index();
                $table->string('type', 16); // credit | debit
                $table->decimal('amount', 14, 2)->default(0);
                $table->string('source', 32)->default('adjustment'); // payment | invoice | refund | adjustment | gateway
                $table->string('gateway')->nullable(); // bkash | nagad | sslcommerz | manual
                $table->uuid('reference_id')->nullable()->index();
                $table->string('reference_type')->nullable();
                $table->text('description')->nullable();
                $table->decimal('balance_after', 14, 2)->default(0);
                $table->uuid('created_by')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'customer_id', 'created_at'], 'wallet_txn_lookup_idx');
            });
        }

        if (!Schema::hasTable('employee_accounts')) {
            Schema::create('employee_accounts', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->nullable()->index();
                $table->uuid('employee_id')->index();
                $table->string('type', 32); // salary | advance | bonus | deduction | settlement_payment
                $table->decimal('amount', 14, 2)->default(0);
                $table->uuid('coa_account_id')->nullable()->index();
                $table->string('reference')->nullable();
                $table->uuid('settlement_id')->nullable()->index();
                $table->uuid('salary_sheet_id')->nullable()->index();
                $table->string('journal_ref')->nullable()->index();
                $table->date('date');
                $table->text('description')->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('employee_settlements')) {
            Schema::create('employee_settlements', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->nullable()->index();
                $table->uuid('employee_id')->index();
                $table->uuid('salary_sheet_id')->nullable()->index();
                $table->string('month')->nullable()->index(); // YYYY-MM
                $table->decimal('total_earn', 14, 2)->default(0);
                $table->decimal('total_deduction', 14, 2)->default(0);
                $table->decimal('net_payable', 14, 2)->default(0);
                $table->string('status', 16)->default('pending'); // pending | paid | cancelled
                $table->string('payment_method')->nullable();
                $table->uuid('paid_from_account_id')->nullable();
                $table->string('journal_ref')->nullable();
                $table->timestamp('settled_at')->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_settlements');
        Schema::dropIfExists('employee_accounts');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('customer_wallets');
    }
};

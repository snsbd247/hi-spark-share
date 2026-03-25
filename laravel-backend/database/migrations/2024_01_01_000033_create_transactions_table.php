<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');                     // income, expense, transfer, journal
            $table->string('category');                 // payment, purchase, sale, salary, utility, refund, adjustment, journal
            $table->decimal('amount', 12, 2);
            $table->decimal('debit', 12, 2)->default(0);
            $table->decimal('credit', 12, 2)->default(0);
            $table->date('date');
            $table->text('description')->nullable();
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->uuid('account_id')->nullable();
            $table->uuid('customer_id')->nullable();
            $table->uuid('vendor_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->string('journal_ref')->nullable();  // groups double-entry pairs
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('accounts')->nullOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
            $table->foreign('vendor_id')->references('id')->on('vendors')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('profiles')->nullOnDelete();

            $table->index('type');
            $table->index('category');
            $table->index('date');
            $table->index('journal_ref');
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};

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
            $table->string('type');                     // income, expense, transfer
            $table->string('category');                 // payment, purchase, sale, salary, utility, refund, adjustment
            $table->decimal('amount', 12, 2);
            $table->date('date');
            $table->text('description')->nullable();
            $table->string('reference_type')->nullable(); // payment, purchase, sale, bill, manual
            $table->uuid('reference_id')->nullable();     // FK to the source record
            $table->uuid('account_id')->nullable();       // which account was affected
            $table->uuid('customer_id')->nullable();
            $table->uuid('vendor_id')->nullable();
            $table->uuid('created_by')->nullable();       // admin profile id
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('accounts')->nullOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
            $table->foreign('vendor_id')->references('id')->on('vendors')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('profiles')->nullOnDelete();

            $table->index('type');
            $table->index('category');
            $table->index('date');
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};

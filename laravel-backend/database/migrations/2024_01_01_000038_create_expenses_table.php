<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('expense_number')->unique();
            $table->string('category');                     // salary, utility, rent, maintenance, transport, internet, office, other
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            $table->text('description')->nullable();
            $table->string('payment_method')->nullable();   // cash, bank, bkash, nagad
            $table->uuid('account_id')->nullable();
            $table->uuid('vendor_id')->nullable();
            $table->string('receipt_url')->nullable();       // attached receipt/image
            $table->string('status')->default('approved');   // pending, approved, rejected
            $table->uuid('created_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('accounts')->nullOnDelete();
            $table->foreign('vendor_id')->references('id')->on('vendors')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('approved_by')->references('id')->on('profiles')->nullOnDelete();

            $table->index('category');
            $table->index('expense_date');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};

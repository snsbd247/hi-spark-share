<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('invoice_number')->unique();
            $table->uuid('customer_id')->nullable();
            $table->string('customer_name')->nullable();     // for walk-in customers
            $table->string('customer_phone')->nullable();
            $table->date('sale_date');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('due_amount', 12, 2)->default(0);
            $table->string('payment_method')->nullable();     // cash, bank, bkash, credit
            $table->string('status')->default('completed');    // completed, partial, returned, cancelled
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('profiles')->nullOnDelete();

            $table->index('sale_date');
            $table->index('status');
            $table->index('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};

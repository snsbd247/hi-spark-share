<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('purchase_number')->unique();
            $table->uuid('vendor_id');
            $table->date('purchase_date');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('due_amount', 12, 2)->default(0);
            $table->string('payment_method')->nullable(); // cash, bank, bkash, credit
            $table->string('status')->default('pending');  // pending, received, partial, cancelled
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('vendor_id')->references('id')->on('vendors')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('profiles')->nullOnDelete();

            $table->index('purchase_date');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};

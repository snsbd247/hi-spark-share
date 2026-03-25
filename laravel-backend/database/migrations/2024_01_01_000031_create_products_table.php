<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('sku')->unique();
            $table->string('category')->nullable(); // router, cable, onu, splitter, other
            $table->text('description')->nullable();
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->integer('stock_quantity')->default(0);
            $table->integer('low_stock_alert')->default(5);
            $table->string('unit')->default('pcs'); // pcs, meter, roll, box
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('sku');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};

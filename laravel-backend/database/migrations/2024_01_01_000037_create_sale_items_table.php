<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id');
            $table->uuid('product_id');
            $table->integer('quantity');
            $table->decimal('unit_price', 12, 2);      // selling price at time of sale
            $table->decimal('cost_price', 12, 2);       // cost at time of sale (for profit calc)
            $table->decimal('total', 12, 2);
            $table->decimal('profit', 12, 2)->default(0);
            $table->timestamps();

            $table->foreign('sale_id')->references('id')->on('sales')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};

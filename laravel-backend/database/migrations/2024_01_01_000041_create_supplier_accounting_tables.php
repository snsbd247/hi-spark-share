<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('company')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('supplier_id');
            $table->decimal('amount', 12, 2);
            $table->date('payment_date');
            $table->string('payment_method')->default('cash');
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->string('status')->default('completed');
            $table->timestamps();

            $table->foreign('supplier_id')->references('id')->on('suppliers')->cascadeOnDelete();
        });

        Schema::create('income_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('expense_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('other_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('type')->default('other'); // income, expense, other
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('other_heads');
        Schema::dropIfExists('expense_heads');
        Schema::dropIfExists('income_heads');
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('suppliers');
    }
};

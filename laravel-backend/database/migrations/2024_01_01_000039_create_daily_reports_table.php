<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('report_date')->unique();
            $table->decimal('total_income', 14, 2)->default(0);
            $table->decimal('billing_income', 14, 2)->default(0);
            $table->decimal('sales_income', 14, 2)->default(0);
            $table->decimal('other_income', 14, 2)->default(0);
            $table->decimal('total_expense', 14, 2)->default(0);
            $table->decimal('purchase_expense', 14, 2)->default(0);
            $table->decimal('operational_expense', 14, 2)->default(0);
            $table->decimal('net_profit', 14, 2)->default(0);
            $table->decimal('gross_profit', 14, 2)->default(0);
            $table->integer('new_customers')->default(0);
            $table->integer('total_sales_count')->default(0);
            $table->integer('total_purchases_count')->default(0);
            $table->integer('bills_paid')->default(0);
            $table->timestamps();

            $table->index('report_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reports');
    }
};

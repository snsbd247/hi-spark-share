<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');                    // e.g. Cash, bKash, Bank, Revenue, Expense
            $table->string('type');                     // asset, liability, income, expense, equity
            $table->string('code')->unique()->nullable(); // e.g. 1001, 2001
            $table->decimal('balance', 14, 2)->default(0);
            $table->text('description')->nullable();
            $table->boolean('is_system')->default(false); // system accounts can't be deleted
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};

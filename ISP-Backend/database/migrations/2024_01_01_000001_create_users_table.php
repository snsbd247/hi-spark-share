<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name')->default('Admin');
            $table->string('email')->nullable();
            $table->string('username')->nullable()->unique();
            $table->string('mobile')->nullable();
            $table->text('address')->nullable();
            $table->string('avatar_url')->nullable();
            $table->string('password_hash')->nullable();
            $table->string('staff_id')->nullable();
            $table->string('status')->default('active');
            $table->string('language')->default('en');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};

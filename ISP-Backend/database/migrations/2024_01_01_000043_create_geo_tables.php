<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geo_divisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('geo_districts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->uuid('division_id');
            $table->string('status')->default('active');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('division_id')->references('id')->on('geo_divisions')->cascadeOnDelete();
        });

        Schema::create('geo_upazilas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->uuid('district_id');
            $table->string('status')->default('active');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('district_id')->references('id')->on('geo_districts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geo_upazilas');
        Schema::dropIfExists('geo_districts');
        Schema::dropIfExists('geo_divisions');
    }
};

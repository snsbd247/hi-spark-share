<?php

/**
 * Idempotent schema patches — safe to run multiple times.
 * Adds missing columns and tables that may not exist after partial deployments.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ── user_roles: add timestamps if missing ────────────
        if (Schema::hasTable('user_roles')) {
            Schema::table('user_roles', function (Blueprint $table) {
                if (!Schema::hasColumn('user_roles', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (!Schema::hasColumn('user_roles', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }

        // ── Ensure cache table exists ────────────────────────
        if (!Schema::hasTable('cache')) {
            Schema::create('cache', function (Blueprint $table) {
                $table->string('key')->primary();
                $table->mediumText('value');
                $table->integer('expiration');
            });
        }

        if (!Schema::hasTable('cache_locks')) {
            Schema::create('cache_locks', function (Blueprint $table) {
                $table->string('key')->primary();
                $table->string('owner');
                $table->integer('expiration');
            });
        }

        // ── Ensure geo tables exist ──────────────────────────
        if (!Schema::hasTable('geo_divisions')) {
            Schema::create('geo_divisions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('bn_name')->nullable();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('geo_districts')) {
            Schema::create('geo_districts', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('bn_name')->nullable();
                $table->uuid('division_id')->index();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('geo_upazilas')) {
            Schema::create('geo_upazilas', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('bn_name')->nullable();
                $table->uuid('district_id')->index();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        }

        // ── Ensure accounts table exists ─────────────────────
        if (!Schema::hasTable('accounts')) {
            Schema::create('accounts', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('type');
                $table->string('code')->nullable()->unique();
                $table->uuid('parent_id')->nullable()->index();
                $table->integer('level')->default(0);
                $table->decimal('balance', 14, 2)->default(0);
                $table->text('description')->nullable();
                $table->boolean('is_system')->default(false);
                $table->boolean('is_active')->default(true);
                $table->string('status')->default('active');
                $table->timestamps();
            });
        }

        // ── Ensure employees has photo_url ───────────────────
        if (Schema::hasTable('employees') && !Schema::hasColumn('employees', 'photo_url')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->string('photo_url')->nullable()->after('address');
            });
        }
    }

    public function down(): void
    {
        // Not reversible — these are safety patches
    }
};

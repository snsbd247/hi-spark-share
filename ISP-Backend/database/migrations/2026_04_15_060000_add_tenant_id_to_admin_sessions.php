<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Add tenant_id to admin_sessions if missing
        if (!Schema::hasColumn('admin_sessions', 'tenant_id')) {
            Schema::table('admin_sessions', function (Blueprint $table) {
                $table->uuid('tenant_id')->nullable()->after('admin_id')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('admin_sessions', 'tenant_id')) {
            Schema::table('admin_sessions', function (Blueprint $table) {
                $table->dropColumn('tenant_id');
            });
        }
    }
};

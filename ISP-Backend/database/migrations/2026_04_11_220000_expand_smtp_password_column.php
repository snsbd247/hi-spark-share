<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('smtp_settings') || !Schema::hasColumn('smtp_settings', 'password')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE smtp_settings MODIFY password TEXT NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE smtp_settings ALTER COLUMN password TYPE TEXT');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('smtp_settings') || !Schema::hasColumn('smtp_settings', 'password')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE smtp_settings MODIFY password VARCHAR(255) NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE smtp_settings ALTER COLUMN password TYPE VARCHAR(255)');
        }
    }
};
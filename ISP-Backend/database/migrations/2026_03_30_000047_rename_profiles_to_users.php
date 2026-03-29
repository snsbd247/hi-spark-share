<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // If 'profiles' exists but 'users' does not → rename
        if (Schema::hasTable('profiles') && !Schema::hasTable('users')) {
            Schema::rename('profiles', 'users');
        }

        // Ensure language column exists
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'language')) {
            Schema::table('users', function ($table) {
                $table->string('language')->default('en')->after('status');
            });
        }
    }

    public function down(): void
    {
        // no-op
    }
};
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'division')) {
                $table->string('division')->nullable()->after('district');
            }
            if (!Schema::hasColumn('customers', 'upazila')) {
                $table->string('upazila')->nullable()->after('division');
            }
            if (!Schema::hasColumn('customers', 'perm_division')) {
                $table->string('perm_division')->nullable()->after('permanent_address');
            }
            if (!Schema::hasColumn('customers', 'perm_district')) {
                $table->string('perm_district')->nullable()->after('perm_division');
            }
            if (!Schema::hasColumn('customers', 'perm_upazila')) {
                $table->string('perm_upazila')->nullable()->after('perm_district');
            }
            if (!Schema::hasColumn('customers', 'perm_village')) {
                $table->string('perm_village')->nullable()->after('perm_upazila');
            }
            if (!Schema::hasColumn('customers', 'perm_road')) {
                $table->string('perm_road')->nullable()->after('perm_village');
            }
            if (!Schema::hasColumn('customers', 'perm_house')) {
                $table->string('perm_house')->nullable()->after('perm_road');
            }
            if (!Schema::hasColumn('customers', 'perm_post_office')) {
                $table->string('perm_post_office')->nullable()->after('perm_house');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'division', 'upazila',
                'perm_division', 'perm_district', 'perm_upazila',
                'perm_village', 'perm_road', 'perm_house', 'perm_post_office',
            ]);
        });
    }
};

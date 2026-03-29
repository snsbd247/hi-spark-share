<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop old foreign key referencing 'profiles', re-create referencing 'users'
        if (Schema::hasTable('user_roles')) {
            // Try dropping the old FK (may be named differently)
            try {
                DB::statement('ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_user_id_foreign`');
            } catch (\Exception $e) {
                // already gone
            }

            try {
                DB::statement('ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_custom_role_id_foreign`');
            } catch (\Exception $e) {
                // already gone
            }

            // Re-add correct foreign keys
            if (Schema::hasTable('users')) {
                DB::statement('ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE');
            }

            if (Schema::hasTable('custom_roles')) {
                DB::statement('ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_custom_role_id_foreign` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON DELETE SET NULL');
            }
        }
    }

    public function down(): void
    {
        // no-op
    }
};

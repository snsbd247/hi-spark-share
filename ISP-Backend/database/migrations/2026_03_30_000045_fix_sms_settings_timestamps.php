<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('sms_settings')) {
            return;
        }

        $hasCreatedAt = Schema::hasColumn('sms_settings', 'created_at');
        $hasUpdatedAt = Schema::hasColumn('sms_settings', 'updated_at');

        if ($hasCreatedAt && $hasUpdatedAt) {
            return;
        }

        Schema::table('sms_settings', function (Blueprint $table) use ($hasCreatedAt, $hasUpdatedAt) {
            if (!$hasCreatedAt) {
                $table->timestamp('created_at')->nullable();
            }

            if (!$hasUpdatedAt) {
                $table->timestamp('updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Intentionally no-op to avoid destructive rollback on production data.
    }
};

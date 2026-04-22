<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * v1.17.2 — Audit & cache addendum.
 *
 * Adds optional fields used by the new audit timeline + COA preview UI:
 *  - wallet_transactions.coa_journal_ref     → links a wallet movement to its journal entry
 *  - employee_settlements.coa_preview_hash   → cache key for the last previewed COA mapping
 *  - wallet_transactions composite index for filter (date range + ref id)
 *
 * Idempotent. Safe to run multiple times. Does not touch any integration table
 * (mikrotik_*, sms_*, payment_gateways, email_configs).
 */
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('wallet_transactions')) {
            Schema::table('wallet_transactions', function (Blueprint $table) {
                if (!Schema::hasColumn('wallet_transactions', 'coa_journal_ref')) {
                    $table->string('coa_journal_ref')->nullable()->after('reference_type')->index();
                }
            });

            // Composite index for timeline filtering (date range + ref id)
            $idx = collect(\DB::select("SHOW INDEX FROM wallet_transactions WHERE Key_name = 'wallet_txn_filter_idx'"));
            if ($idx->isEmpty()) {
                try {
                    Schema::table('wallet_transactions', function (Blueprint $table) {
                        $table->index(['tenant_id', 'type', 'created_at'], 'wallet_txn_filter_idx');
                    });
                } catch (\Throwable $e) { /* index may already exist under a different name */ }
            }
        }

        if (Schema::hasTable('employee_settlements')) {
            Schema::table('employee_settlements', function (Blueprint $table) {
                if (!Schema::hasColumn('employee_settlements', 'coa_preview_hash')) {
                    $table->string('coa_preview_hash', 64)->nullable()->after('journal_ref');
                }
                if (!Schema::hasColumn('employee_settlements', 'coa_preview_at')) {
                    $table->timestamp('coa_preview_at')->nullable()->after('coa_preview_hash');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('wallet_transactions')) {
            Schema::table('wallet_transactions', function (Blueprint $table) {
                if (Schema::hasColumn('wallet_transactions', 'coa_journal_ref')) {
                    try { $table->dropIndex(['coa_journal_ref']); } catch (\Throwable $e) {}
                    $table->dropColumn('coa_journal_ref');
                }
                try { $table->dropIndex('wallet_txn_filter_idx'); } catch (\Throwable $e) {}
            });
        }

        if (Schema::hasTable('employee_settlements')) {
            Schema::table('employee_settlements', function (Blueprint $table) {
                foreach (['coa_preview_hash', 'coa_preview_at'] as $col) {
                    if (Schema::hasColumn('employee_settlements', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};

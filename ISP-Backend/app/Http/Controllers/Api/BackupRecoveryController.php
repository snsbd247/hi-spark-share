<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FullBackupService;
use App\Services\TenantBackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BackupRecoveryController extends Controller
{
    public function __construct(
        private FullBackupService $fullBackup,
        private TenantBackupService $tenantBackup,
    ) {}

    // ── List all backup logs ──────────────────────────────
    public function logs(Request $request)
    {
        $logs = DB::table('backup_logs')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json($logs);
    }

    // ── Create full backup ────────────────────────────────
    public function createFull(Request $request)
    {
        $admin = $request->get('super_admin');
        $result = $this->fullBackup->create($admin->id ?? 'system');
        return response()->json(['success' => true, ...$result]);
    }

    // ── Create tenant backup ──────────────────────────────
    public function createTenant(Request $request)
    {
        $request->validate(['tenant_id' => 'required|uuid']);
        $admin = $request->get('super_admin');
        $result = $this->tenantBackup->create(
            $request->input('tenant_id'),
            $admin->id ?? 'system'
        );
        return response()->json(['success' => true, ...$result]);
    }

    // ── Download backup ───────────────────────────────────
    public function download(Request $request)
    {
        $request->validate(['file_path' => 'required|string']);
        $filePath = $request->input('file_path');
        $fullPath = storage_path("app/{$filePath}");

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        return response()->download($fullPath);
    }

    // ── Restore full backup ───────────────────────────────
    public function restoreFull(Request $request)
    {
        $request->validate(['file_path' => 'required|string']);

        // Safety: create a backup before restore
        $admin = $request->get('super_admin');
        $safetyBackup = $this->fullBackup->create($admin->id ?? 'system');

        try {
            $this->fullBackup->restore($request->input('file_path'));

            DB::table('backup_logs')->insert([
                'id' => Str::uuid()->toString(),
                'file_name' => 'restore_' . basename($request->input('file_path')),
                'file_size' => 0,
                'backup_type' => 'full_restore',
                'status' => 'completed',
                'created_by' => $admin->id ?? 'system',
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Full restore completed',
                'safety_backup' => $safetyBackup['file_name'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Restore failed: ' . $e->getMessage(),
                'safety_backup' => $safetyBackup['file_name'],
            ], 500);
        }
    }

    // ── Restore tenant backup ─────────────────────────────
    public function restoreTenant(Request $request)
    {
        $request->validate([
            'tenant_id' => 'required|uuid',
            'file_path' => 'required|string',
        ]);

        // Safety backup first
        $admin = $request->get('super_admin');
        $safetyBackup = $this->tenantBackup->create(
            $request->input('tenant_id'),
            $admin->id ?? 'system'
        );

        try {
            $this->tenantBackup->restore(
                $request->input('tenant_id'),
                $request->input('file_path')
            );

            DB::table('backup_logs')->insert([
                'id' => Str::uuid()->toString(),
                'file_name' => 'restore_' . basename($request->input('file_path')),
                'file_size' => 0,
                'backup_type' => 'tenant_restore',
                'status' => 'completed',
                'created_by' => $admin->id ?? 'system',
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Tenant restore completed',
                'safety_backup' => $safetyBackup['file_name'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Restore failed: ' . $e->getMessage(),
                'safety_backup' => $safetyBackup['file_name'],
            ], 500);
        }
    }

    // ── Verify backup ─────────────────────────────────────
    public function verify(Request $request)
    {
        $request->validate(['file_path' => 'required|string']);
        $result = $this->fullBackup->verify($request->input('file_path'));
        return response()->json($result);
    }

    // ── Rollback (restore last backup) ────────────────────
    public function rollback(Request $request)
    {
        $type = $request->input('type', 'full');
        $tenantId = $request->input('tenant_id');

        $query = DB::table('backup_logs')
            ->where('status', 'completed')
            ->whereNotIn('backup_type', ['full_restore', 'tenant_restore'])
            ->orderByDesc('created_at');

        if ($type === 'tenant' && $tenantId) {
            $query->where('backup_type', 'tenant')
                  ->where('file_name', 'like', "tenant_{$tenantId}%");
        } else {
            $query->where('backup_type', 'full');
        }

        $lastBackup = $query->first();
        if (!$lastBackup) {
            return response()->json(['error' => 'No backup found for rollback'], 404);
        }

        // Determine file path
        $filePath = $type === 'tenant' && $tenantId
            ? "backups/tenants/{$tenantId}/{$lastBackup->file_name}"
            : "backups/full/{$lastBackup->file_name}";

        if ($type === 'tenant' && $tenantId) {
            $request->merge(['file_path' => $filePath, 'tenant_id' => $tenantId]);
            return $this->restoreTenant($request);
        }

        $request->merge(['file_path' => $filePath]);
        return $this->restoreFull($request);
    }

    // ── Delete a backup ───────────────────────────────────
    public function delete(Request $request)
    {
        $request->validate(['file_path' => 'required|string']);
        $fullPath = storage_path("app/{$request->input('file_path')}");

        if (file_exists($fullPath)) {
            unlink($fullPath);
        }

        DB::table('backup_logs')
            ->where('file_name', basename($request->input('file_path')))
            ->delete();

        return response()->json(['success' => true]);
    }

    // ── Cleanup old backups ───────────────────────────────
    public function cleanup(Request $request)
    {
        $keepDays = (int) $request->input('keep_days', 30);
        $cutoff = now()->subDays($keepDays)->timestamp;
        $deleted = 0;

        foreach (['backups/full', 'backups/tenants'] as $base) {
            $dir = storage_path("app/{$base}");
            if (!is_dir($dir)) continue;

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
            );

            foreach ($iterator as $file) {
                if ($file->isFile() && $file->getMTime() < $cutoff) {
                    unlink($file->getPathname());
                    $deleted++;
                }
            }
        }

        // Clean log entries too
        DB::table('backup_logs')
            ->where('created_at', '<', now()->subDays($keepDays))
            ->delete();

        return response()->json(['success' => true, 'deleted' => $deleted]);
    }

    // ── Auto backup settings ──────────────────────────────
    public function autoBackupSettings()
    {
        $settings = DB::table('system_settings')
            ->whereIn('setting_key', [
                'auto_backup_enabled',
                'auto_backup_frequency',
                'auto_backup_keep_count',
            ])
            ->pluck('setting_value', 'setting_key');

        return response()->json([
            'enabled' => ($settings['auto_backup_enabled'] ?? 'false') === 'true',
            'frequency' => $settings['auto_backup_frequency'] ?? 'daily',
            'keep_count' => (int) ($settings['auto_backup_keep_count'] ?? 10),
        ]);
    }

    public function updateAutoBackupSettings(Request $request)
    {
        $request->validate([
            'enabled' => 'required|boolean',
            'frequency' => 'required|in:daily,weekly',
            'keep_count' => 'required|integer|min:1|max:100',
        ]);

        $settings = [
            'auto_backup_enabled' => $request->boolean('enabled') ? 'true' : 'false',
            'auto_backup_frequency' => $request->input('frequency'),
            'auto_backup_keep_count' => (string) $request->input('keep_count'),
        ];

        foreach ($settings as $key => $value) {
            DB::table('system_settings')->updateOrInsert(
                ['setting_key' => $key],
                ['setting_value' => $value, 'updated_at' => now()]
            );
        }

        return response()->json(['success' => true]);
    }
}

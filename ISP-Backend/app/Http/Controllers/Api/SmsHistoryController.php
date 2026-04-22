<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmsLog;
use App\Services\ActivityLogger;
use App\Support\Auth\AdminContext;
use Illuminate\Http\Request;

class SmsHistoryController extends Controller
{
    /**
     * Tenant SMS history — auto-scoped to the authenticated tenant.
     * Read-only. Never touches integration configs.
     */
    public function tenantHistory(Request $request)
    {
        $tenantId = tenant_id();

        $query = SmsLog::query()->orderBy('created_at', 'desc');

        // Hard tenant scope (defence-in-depth, even if model lacks BelongsToTenant)
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        } else {
            // No tenant context on a tenant-only endpoint → return nothing
            return response()->json(['data' => [], 'total' => 0, 'current_page' => 1, 'last_page' => 1, 'per_page' => 0]);
        }

        $this->applyFilters($query, $request);

        $perPage = $this->resolvePerPage($request, 50, 200);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'data'         => $paginated->items(),
            'total'        => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
            'per_page'     => $paginated->perPage(),
        ]);
    }

    /**
     * Super Admin SMS history — across all tenants, optional tenant_id filter.
     *
     * Authorization: route is already behind SuperAdminAuth middleware. We
     * additionally:
     *   1. Re-verify the request carries a valid super-admin context.
     *   2. Emit an ActivityLog entry recording who accessed which slice.
     *      Failures here are swallowed so audit overhead never blocks reads.
     */
    public function superHistory(Request $request)
    {
        $admin = AdminContext::user($request);
        if (!$admin || !AdminContext::isSuperAdmin($admin)) {
            return response()->json(['error' => 'Forbidden — super admin only'], 403);
        }

        $query = SmsLog::query()->orderBy('created_at', 'desc');

        $tenantFilter = $request->input('tenant_id');
        if ($tenantFilter) {
            $query->where('tenant_id', $tenantFilter);
        }

        $this->applyFilters($query, $request);

        $perPage = $this->resolvePerPage($request, 50, 500);
        $paginated = $query->paginate($perPage);

        // Audit log — non-blocking. Only logs the access metadata, not message bodies.
        try {
            ActivityLogger::log(
                action: 'view',
                module: 'sms_history',
                description: sprintf(
                    'Super admin viewed SMS history (tenant=%s, status=%s, type=%s, page=%d, per_page=%d, results=%d)',
                    $tenantFilter ?: 'all',
                    $request->input('status') ?: 'all',
                    $request->input('sms_type') ?: 'all',
                    $paginated->currentPage(),
                    $paginated->perPage(),
                    $paginated->total()
                ),
                userId: AdminContext::id($admin),
                tenantId: null,
                metadata: [
                    'tenant_id' => $tenantFilter,
                    'status'    => $request->input('status'),
                    'sms_type'  => $request->input('sms_type'),
                    'phone'     => $request->input('phone'),
                    'from'      => $request->input('from'),
                    'to'        => $request->input('to'),
                    'search'    => $request->input('search'),
                    'page'      => $paginated->currentPage(),
                    'per_page'  => $paginated->perPage(),
                ],
                request: $request
            );
        } catch (\Throwable $e) {
            // Never block history access if audit write fails
        }

        return response()->json([
            'data'         => $paginated->items(),
            'total'        => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
            'per_page'     => $paginated->perPage(),
        ]);
    }

    private function applyFilters($query, Request $request): void
    {
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($type = $request->input('sms_type')) {
            $query->where('sms_type', $type);
        }
        if ($phone = $request->input('phone')) {
            $query->where('phone', 'like', "%{$phone}%");
        }
        if ($from = $request->input('from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('phone', 'like', "%{$search}%")
                  ->orWhere('message', 'like', "%{$search}%");
            });
        }
    }

    private function resolvePerPage(Request $request, int $default, int $max): int
    {
        $value = (int) $request->input('per_page', $default);
        if ($value <= 0) $value = $default;
        return min($value, $max);
    }
}

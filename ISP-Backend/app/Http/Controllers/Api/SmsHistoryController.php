<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmsLog;
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
            return response()->json(['data' => [], 'total' => 0]);
        }

        $this->applyFilters($query, $request);

        $perPage = min((int) $request->input('per_page', 50), 200);
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
     */
    public function superHistory(Request $request)
    {
        $query = SmsLog::query()->orderBy('created_at', 'desc');

        if ($tenantId = $request->input('tenant_id')) {
            $query->where('tenant_id', $tenantId);
        }

        $this->applyFilters($query, $request);

        $perPage = min((int) $request->input('per_page', 50), 500);
        $paginated = $query->paginate($perPage);

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
}

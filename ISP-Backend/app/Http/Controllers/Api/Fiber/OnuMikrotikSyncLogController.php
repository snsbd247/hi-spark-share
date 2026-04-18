<?php

namespace App\Http\Controllers\Api\Fiber;

use App\Http\Controllers\Controller;
use App\Models\OnuMikrotikSyncLog;
use Illuminate\Http\Request;

/**
 * Phase 11 — auto-sync audit log endpoint.
 */
class OnuMikrotikSyncLogController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id ?? null;

        $rows = OnuMikrotikSyncLog::query()
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->when($request->query('serial'), fn($q, $s) => $q->where('serial_number', $s))
            ->when($request->query('customer_id'), fn($q, $c) => $q->where('customer_id', $c))
            ->when($request->query('action'), fn($q, $a) => $q->where('action', $a))
            ->orderByDesc('executed_at')
            ->limit(500)
            ->get();

        return response()->json($rows);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IpPool;
use App\Models\MikrotikRouter;
use App\Services\MikrotikService;
use App\Jobs\SyncIpPoolsJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class IpPoolController extends Controller
{
    public function __construct(protected MikrotikService $mikrotikService) {}

    /**
     * POST /api/mikrotik/sync-ip-pools
     * Sync IP pools from MikroTik router to database.
     */
    public function syncFromRouter(Request $request)
    {
        $request->validate([
            'router_id' => 'required|uuid|exists:mikrotik_routers,id',
        ]);

        try {
            $tenantId = $request->get('__tenant_id');
            $result = $this->mikrotikService->syncIpPools($request->router_id, $tenantId);
            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('IP Pool sync failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Sync failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/mikrotik/push-ip-pool
     * Push a single IP pool from SaaS to MikroTik router.
     */
    public function pushToRouter(Request $request)
    {
        $request->validate([
            'pool_id' => 'required|uuid|exists:ip_pools,id',
        ]);

        try {
            $pool = IpPool::with('router')->findOrFail($request->pool_id);
            $result = $this->mikrotikService->pushIpPool($pool);
            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('IP Pool push failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Push failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/mikrotik/push-all-ip-pools
     * Push all IP pools for a router to MikroTik.
     */
    public function pushAllToRouter(Request $request)
    {
        $request->validate([
            'router_id' => 'required|uuid|exists:mikrotik_routers,id',
        ]);

        try {
            $pools = IpPool::where('router_id', $request->router_id)->get();
            $results = ['pushed' => 0, 'failed' => 0, 'errors' => []];

            foreach ($pools as $pool) {
                $pool->load('router');
                $result = $this->mikrotikService->pushIpPool($pool);
                if ($result['success']) {
                    $results['pushed']++;
                } else {
                    $results['failed']++;
                    $results['errors'][] = "{$pool->name}: " . ($result['error'] ?? 'Unknown error');
                }
            }

            return response()->json(['success' => true, ...$results]);
        } catch (\Exception $e) {
            Log::error('IP Pool push-all failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/mikrotik/queue-sync-ip-pools
     * Queue-based sync for heavy operations.
     */
    public function queueSync(Request $request)
    {
        $request->validate([
            'router_id' => 'required|uuid|exists:mikrotik_routers,id',
        ]);

        $tenantId = $request->get('__tenant_id');
        SyncIpPoolsJob::dispatch($request->router_id, $tenantId);

        return response()->json(['success' => true, 'message' => 'IP Pool sync queued']);
    }
}

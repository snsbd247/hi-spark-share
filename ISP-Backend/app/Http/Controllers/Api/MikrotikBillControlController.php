<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Package;
use App\Services\MikrotikService;
use Illuminate\Http\Request;

class MikrotikBillControlController extends Controller
{
    public function __construct(protected MikrotikService $mikrotikService) {}

    /**
     * POST /api/mikrotik/bill-control
     * Enable or disable a customer based on bill status.
     */
    public function billControl(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid|exists:customers,id',
            'action'      => 'required|in:enable,disable',
        ]);

        $customer = Customer::with('router')->findOrFail($request->customer_id);

        if (!$customer->router) {
            return response()->json(['success' => false, 'error' => 'No router assigned'], 422);
        }

        $result = $request->action === 'disable'
            ? $this->mikrotikService->disablePppoe($customer)
            : $this->mikrotikService->enablePppoe($customer);

        return response()->json($result);
    }

    /**
     * POST /api/mikrotik/disable-pppoe
     */
    public function disablePppoe(Request $request)
    {
        $request->validate(['customer_id' => 'required|uuid|exists:customers,id']);
        $customer = Customer::with('router')->findOrFail($request->customer_id);

        if (!$customer->router || !$customer->pppoe_username) {
            return response()->json(['success' => false, 'error' => 'Missing router or PPPoE credentials'], 422);
        }

        return response()->json($this->mikrotikService->disablePppoe($customer));
    }

    /**
     * POST /api/mikrotik/enable-pppoe
     */
    public function enablePppoe(Request $request)
    {
        $request->validate(['customer_id' => 'required|uuid|exists:customers,id']);
        $customer = Customer::with('router')->findOrFail($request->customer_id);

        if (!$customer->router || !$customer->pppoe_username) {
            return response()->json(['success' => false, 'error' => 'Missing router or PPPoE credentials'], 422);
        }

        return response()->json($this->mikrotikService->enablePppoe($customer));
    }

    /**
     * POST /api/mikrotik/sync-profile
     * Sync a single package profile to its assigned router.
     */
    public function syncProfile(Request $request)
    {
        $request->validate(['package_id' => 'required|uuid|exists:packages,id']);
        $package = Package::with('router')->findOrFail($request->package_id);

        if (!$package->router) {
            return response()->json(['success' => false, 'error' => 'No router assigned to package'], 422);
        }

        return response()->json($this->mikrotikService->syncProfile($package));
    }

    /**
     * POST /api/mikrotik/remove-profile
     */
    public function removeProfile(Request $request)
    {
        $request->validate(['package_id' => 'required|uuid|exists:packages,id']);
        $package = Package::with('router')->findOrFail($request->package_id);

        if (!$package->router) {
            return response()->json(['success' => false, 'error' => 'No router assigned to package'], 422);
        }

        return response()->json($this->mikrotikService->removeProfile($package));
    }

    /**
     * POST /api/mikrotik/bulk-sync-packages
     * Sync all active package profiles to their routers.
     */
    public function bulkSyncPackages()
    {
        $packages = Package::whereNotNull('router_id')->where('is_active', true)->get();
        $results  = ['synced' => 0, 'failed' => 0, 'total' => $packages->count()];

        foreach ($packages as $package) {
            $r = $this->mikrotikService->syncProfile($package);
            $r['success'] ? $results['synced']++ : $results['failed']++;
        }

        return response()->json($results);
    }

    /**
     * GET /api/mikrotik/router-stats/{routerId}
     */
    public function routerStats(string $routerId)
    {
        return response()->json($this->mikrotikService->getRouterStats($routerId));
    }

    /**
     * POST /api/mikrotik/router-stats — Aggregated stats for all routers
     */
    public function allRouterStats()
    {
        $routers = \App\Models\MikrotikRouter::all();
        $totalOnline = 0;
        $totalSuspended = 0;
        $routerList = [];

        foreach ($routers as $router) {
            $stats = $this->mikrotikService->getRouterStats($router->id);
            if ($stats['success']) {
                $online = (int) ($stats['data']['active_connections'] ?? 0);
                $totalOnline += $online;
                $routerList[] = [
                    'name' => $router->name,
                    'online' => $online,
                    'suspended' => 0,
                ];
            } else {
                $routerList[] = [
                    'name' => $router->name,
                    'online' => 0,
                    'suspended' => 0,
                    'error' => $stats['error'] ?? 'Connection failed',
                ];
            }
        }

        return response()->json([
            'total_online' => $totalOnline,
            'total_suspended' => $totalSuspended,
            'routers' => $routerList,
        ]);
    }
}

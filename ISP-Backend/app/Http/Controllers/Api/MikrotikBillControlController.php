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
        // If customer_id provided → single customer bill control (legacy)
        if ($request->has('customer_id')) {
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

        // Bulk bill control — suspend unpaid, reactivate paid
        return $this->bulkBillControl($request);
    }

    /**
     * Bulk bill control: disable customers with unpaid bills, enable those who paid.
     */
    protected function bulkBillControl(Request $request)
    {
        $tenantId = $request->get('__tenant_id') ?: tenant_id();
        $currentMonth = now()->format('Y-m');

        $suspended = 0;
        $reactivated = 0;
        $skipped = 0;
        $errors = [];

        // Get customers with unpaid bills who are active/pending → suspend them
        $unpaidCustomers = Customer::with('router')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['active', 'pending_reactivation'])
            ->whereNotNull('pppoe_username')
            ->whereHas('bills', function ($q) use ($currentMonth) {
                $q->where('status', 'unpaid')
                  ->where('month', $currentMonth);
            })
            ->get();

        foreach ($unpaidCustomers as $customer) {
            if (!$customer->router) { $skipped++; continue; }
            try {
                $result = $this->mikrotikService->disablePppoe($customer);
                if ($result['success'] ?? false) {
                    $customer->update([
                        'status' => 'suspended',
                        'connection_status' => 'disabled',
                    ]);
                    $suspended++;
                } else {
                    $errors[] = "{$customer->customer_id}: " . ($result['error'] ?? 'Failed');
                }
            } catch (\Exception $e) {
                $errors[] = "{$customer->customer_id}: {$e->getMessage()}";
            }
        }

        // Get suspended/pending-reactivation customers with no unpaid current-month bill → reactivate
        $paidCustomers = Customer::with('router')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['suspended', 'pending_reactivation'])
            ->whereNotNull('pppoe_username')
            ->whereDoesntHave('bills', function ($q) use ($currentMonth) {
                $q->where('status', 'unpaid')
                  ->where('month', $currentMonth);
            })
            ->get();

        foreach ($paidCustomers as $customer) {
            if (!$customer->router) { $skipped++; continue; }
            try {
                $result = $this->mikrotikService->enablePppoe($customer);
                if ($result['success'] ?? false) {
                    $customer->update([
                        'status' => 'active',
                        'connection_status' => 'active',
                    ]);
                    $reactivated++;
                } else {
                    $errors[] = "{$customer->customer_id}: " . ($result['error'] ?? 'Failed');
                }
            } catch (\Exception $e) {
                $errors[] = "{$customer->customer_id}: {$e->getMessage()}";
            }
        }

        return response()->json([
            'success' => true,
            'results' => [
                'suspended'   => $suspended,
                'reactivated' => $reactivated,
                'skipped'     => $skipped,
                'errors'      => $errors,
            ],
        ]);
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
        $results  = ['success' => true, 'synced' => 0, 'failed' => 0, 'total' => $packages->count()];

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

    /**
     * POST /api/mikrotik/import-users — Import PPPoE secrets as customers
     */
    public function importUsers(Request $request)
    {
        $request->validate(['router_id' => 'required|uuid|exists:mikrotik_routers,id']);
        $tenantId = $request->get('__tenant_id') ?: tenant_id();
        $result = $this->mikrotikService->importUsersFromRouter($request->router_id, $tenantId);
        return response()->json($result);
    }

    /**
     * POST /api/mikrotik/import-packages — Import PPPoE profiles as packages
     */
    public function importPackages(Request $request)
    {
        $request->validate(['router_id' => 'required|uuid|exists:mikrotik_routers,id']);
        $tenantId = $request->get('__tenant_id') ?: tenant_id();
        $result = $this->mikrotikService->importPackagesFromRouter($request->router_id, $tenantId);
        return response()->json($result);
    }
}

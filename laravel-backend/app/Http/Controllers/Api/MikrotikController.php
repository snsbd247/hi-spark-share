<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MikrotikService;
use Illuminate\Http\Request;

class MikrotikController extends Controller
{
    public function __construct(protected MikrotikService $mikrotikService) {}

    public function sync(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid|exists:customers,id',
        ]);

        $result = $this->mikrotikService->syncCustomer($request->customer_id);
        return response()->json($result);
    }

    public function syncAll()
    {
        $result = $this->mikrotikService->syncAllCustomers();
        return response()->json($result);
    }

    public function testConnection(Request $request)
    {
        $request->validate(['router_id' => 'required|uuid|exists:mikrotik_routers,id']);
        $result = $this->mikrotikService->testConnection($request->router_id);
        return response()->json($result);
    }
}

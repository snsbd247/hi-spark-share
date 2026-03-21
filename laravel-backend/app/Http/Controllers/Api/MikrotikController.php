<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MikrotikSyncRequest;
use App\Http\Requests\MikrotikTestRequest;
use App\Services\MikrotikService;
use Illuminate\Http\Request;

class MikrotikController extends Controller
{
    public function __construct(protected MikrotikService $mikrotikService) {}

    public function sync(MikrotikSyncRequest $request)
    {

        $result = $this->mikrotikService->syncCustomer($request->customer_id);
        return response()->json($result);
    }

    public function syncAll()
    {
        $result = $this->mikrotikService->syncAllCustomers();
        return response()->json($result);
    }

    public function testConnection(MikrotikTestRequest $request)
    {
        $result = $this->mikrotikService->testConnection($request->router_id);
        return response()->json($result);
    }
}

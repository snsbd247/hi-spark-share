<?php

namespace App\Http\Controllers\Api\Fiber;

use App\Http\Controllers\Controller;
use App\Models\OltDevice;
use App\Models\OnuLiveStatus;
use App\Services\Fiber\CredentialVault;
use App\Services\Fiber\OltConnector;
use App\Services\Fiber\OnuStatusUpdater;
use Illuminate\Http\Request;

class OltDeviceController extends Controller
{
    public function __construct(
        private CredentialVault $vault,
        private OltConnector $connector,
        private OnuStatusUpdater $updater,
    ) {}

    public function index()
    {
        return response()->json(
            OltDevice::orderBy('name')->get()->map(fn($d) => $this->present($d))
        );
    }

    public function show($id)
    {
        $device = OltDevice::findOrFail($id);
        return response()->json($this->present($device));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'ip_address' => 'required|string|max:64',
            'port' => 'nullable|integer|min:1|max:65535',
            'api_port' => 'nullable|integer|min:1|max:65535',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string|max:255',
            'vendor' => 'required|in:huawei,zte,vsol,bdcom',
            'connection_type' => 'nullable|in:api,cli,hybrid',
            'fiber_olt_id' => 'nullable|uuid',
            'poll_interval_sec' => 'nullable|integer|min:30|max:3600',
            'is_active' => 'nullable|boolean',
        ]);

        $device = new OltDevice();
        $device->fill([
            'name' => $data['name'],
            'ip_address' => $data['ip_address'],
            'port' => $data['port'] ?? 22,
            'api_port' => $data['api_port'] ?? null,
            'username' => $data['username'] ?? null,
            'vendor' => $data['vendor'],
            'connection_type' => $data['connection_type'] ?? 'cli',
            'fiber_olt_id' => $data['fiber_olt_id'] ?? null,
            'poll_interval_sec' => $data['poll_interval_sec'] ?? 300,
            'is_active' => $data['is_active'] ?? true,
        ]);
        if (!empty($data['password'])) {
            $device->password_encrypted = $this->vault->encrypt($data['password'], request()->attributes->get('tenant_id'));
            $device->encryption_key_id = $this->vault->currentKeyId();
        }
        $device->save();
        return response()->json($this->present($device), 201);
    }

    public function update(Request $request, $id)
    {
        $device = OltDevice::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'ip_address' => 'sometimes|string|max:64',
            'port' => 'nullable|integer|min:1|max:65535',
            'api_port' => 'nullable|integer|min:1|max:65535',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string|max:255',
            'vendor' => 'sometimes|in:huawei,zte,vsol,bdcom',
            'connection_type' => 'nullable|in:api,cli,hybrid',
            'poll_interval_sec' => 'nullable|integer|min:30|max:3600',
            'is_active' => 'nullable|boolean',
        ]);
        $device->fill(collect($data)->except('password')->toArray());
        if (array_key_exists('password', $data) && $data['password'] !== null && $data['password'] !== '') {
            $device->password_encrypted = $this->vault->encrypt($data['password'], $device->tenant_id);
            $device->encryption_key_id = $this->vault->currentKeyId();
        }
        $device->save();
        return response()->json($this->present($device));
    }

    public function destroy($id)
    {
        $device = OltDevice::findOrFail($id);
        $device->delete();
        return response()->json(['message' => 'OLT device deleted']);
    }

    public function testConnection($id)
    {
        $device = OltDevice::findOrFail($id);
        $res = $this->connector->testConnection($device);
        return response()->json($res);
    }

    public function poll($id)
    {
        $device = OltDevice::findOrFail($id);
        $res = $this->connector->pollOnus($device);
        if (!($res['ok'] ?? false)) {
            $device->update(['status' => 'offline', 'last_polled_at' => now()]);
            return response()->json(['ok' => false, 'error' => $res['error'] ?? 'poll failed'], 200);
        }
        $persist = $this->updater->apply($device, $res['onus'] ?? []);
        $device->update(['status' => 'online', 'last_polled_at' => now()]);
        return response()->json([
            'ok' => true,
            'mode' => $res['mode'] ?? null,
            'count' => count($res['onus'] ?? []),
            'persisted' => $persist,
        ]);
    }

    public function liveStatus(Request $request)
    {
        $q = OnuLiveStatus::query()->orderByDesc('last_seen');
        if ($request->olt_device_id) $q->where('olt_device_id', $request->olt_device_id);
        if ($request->status) $q->where('status', $request->status);
        if ($request->search) $q->where('serial_number', 'like', '%' . $request->search . '%');
        return response()->json($q->limit(1000)->get());
    }

    private function present(OltDevice $d): array
    {
        return [
            'id' => $d->id,
            'tenant_id' => $d->tenant_id,
            'fiber_olt_id' => $d->fiber_olt_id,
            'name' => $d->name,
            'ip_address' => $d->ip_address,
            'port' => $d->port,
            'api_port' => $d->api_port,
            'username' => $d->username,
            'password_masked' => CredentialVault::mask($d->password_encrypted ? '••••••••' : null),
            'has_password' => !empty($d->password_encrypted),
            'vendor' => $d->vendor,
            'connection_type' => $d->connection_type,
            'status' => $d->status,
            'poll_interval_sec' => $d->poll_interval_sec,
            'is_active' => $d->is_active,
            'last_polled_at' => optional($d->last_polled_at)->toIso8601String(),
            'created_at' => optional($d->created_at)->toIso8601String(),
        ];
    }
}

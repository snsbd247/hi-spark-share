<?php

namespace App\Http\Controllers\Api\Fiber;

use App\Http\Controllers\Controller;
use App\Models\FiberOlt;
use App\Models\FiberPonPort;
use App\Models\OltDevice;
use App\Models\OnuLiveStatus;
use App\Services\Fiber\CredentialVault;
use App\Services\Fiber\OltConnector;
use App\Services\Fiber\OnuStatusUpdater;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    /**
     * SSOT atomic create: writes fiber_olts (master) + fiber_pon_ports + olt_devices in one transaction.
     * Single entry-point for both Topology and Live Monitoring pages.
     */
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
            'fiber_olt_id' => 'nullable|uuid',                  // when linking to existing topology OLT
            'location' => 'nullable|string',                    // topology fields
            'total_pon_ports' => 'nullable|integer|min:1|max:64',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'poll_interval_sec' => 'nullable|integer|min:30|max:3600',
            'is_active' => 'nullable|boolean',
        ]);

        $tenantId = request()->attributes->get('tenant_id');

        return DB::transaction(function () use ($data, $tenantId) {
            // Step 1: resolve or create fiber_olts master row (1 OLT = 1 entry)
            $fiberOltId = $data['fiber_olt_id'] ?? null;
            if ($fiberOltId) {
                // Reuse existing topology OLT — enforce 1:1 (no duplicate olt_devices for same fiber_olt)
                $alreadyLinked = OltDevice::where('fiber_olt_id', $fiberOltId)->exists();
                if ($alreadyLinked) {
                    abort(422, 'This topology OLT already has live monitoring credentials configured.');
                }
                $fiberOlt = FiberOlt::findOrFail($fiberOltId);
            } else {
                $fiberOlt = FiberOlt::create([
                    'tenant_id' => $tenantId,
                    'name' => $data['name'],
                    'location' => $data['location'] ?? null,
                    'total_pon_ports' => $data['total_pon_ports'] ?? 8,
                    'status' => 'active',
                    'lat' => $data['lat'] ?? null,
                    'lng' => $data['lng'] ?? null,
                ]);
                // Auto-create PON ports (matches Topology behavior)
                $portCount = $data['total_pon_ports'] ?? 8;
                for ($i = 1; $i <= $portCount; $i++) {
                    FiberPonPort::create([
                        'tenant_id' => $tenantId,
                        'olt_id' => $fiberOlt->id,
                        'port_number' => $i,
                        'status' => 'active',
                    ]);
                }
            }

            // Step 2: create olt_devices (credentials/monitoring side)
            $device = new OltDevice();
            $device->fill([
                'tenant_id' => $tenantId,
                'fiber_olt_id' => $fiberOlt->id,
                'name' => $data['name'],
                'ip_address' => $data['ip_address'],
                'port' => $data['port'] ?? 22,
                'api_port' => $data['api_port'] ?? null,
                'username' => $data['username'] ?? null,
                'vendor' => $data['vendor'],
                'connection_type' => $data['connection_type'] ?? 'cli',
                'poll_interval_sec' => $data['poll_interval_sec'] ?? 300,
                'is_active' => $data['is_active'] ?? true,
            ]);
            if (!empty($data['password'])) {
                $device->password_encrypted = $this->vault->encrypt($data['password'], $tenantId);
                $device->encryption_key_id = $this->vault->currentKeyId();
            }
            $device->save();

            return response()->json($this->present($device), 201);
        });
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
            'location' => 'nullable|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'poll_interval_sec' => 'nullable|integer|min:30|max:3600',
            'is_active' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($device, $data) {
            // Sync topology fields back to fiber_olts master (SSOT)
            if ($device->fiber_olt_id) {
                $fiberUpdates = array_filter([
                    'name' => $data['name'] ?? null,
                    'location' => $data['location'] ?? null,
                    'lat' => $data['lat'] ?? null,
                    'lng' => $data['lng'] ?? null,
                ], fn($v) => $v !== null);
                if (!empty($fiberUpdates)) {
                    FiberOlt::where('id', $device->fiber_olt_id)->update($fiberUpdates);
                }
            }

            $device->fill(collect($data)->except(['password', 'location', 'lat', 'lng'])->toArray());
            if (array_key_exists('password', $data) && $data['password'] !== null && $data['password'] !== '') {
                $device->password_encrypted = $this->vault->encrypt($data['password'], $device->tenant_id);
                $device->encryption_key_id = $this->vault->currentKeyId();
            }
            $device->save();
            return response()->json($this->present($device));
        });
    }

    /**
     * SSOT-aware delete: removes olt_devices row only.
     * fiber_olts master is preserved unless ?cascade=1.
     */
    public function destroy(Request $request, $id)
    {
        $device = OltDevice::findOrFail($id);
        $cascade = (bool) $request->query('cascade', false);
        return DB::transaction(function () use ($device, $cascade) {
            $fiberOltId = $device->fiber_olt_id;
            $device->delete();
            if ($cascade && $fiberOltId) {
                FiberPonPort::where('olt_id', $fiberOltId)->delete();
                FiberOlt::where('id', $fiberOltId)->delete();
            }
            return response()->json(['message' => 'OLT device deleted', 'cascaded' => $cascade]);
        });
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

        // Phase 8: WebSocket live push (Reverb). Silent if broadcast driver is "null".
        try {
            event(new \App\Events\OnuStatusUpdated($device, count($res['onus'] ?? []), $persist));
        } catch (\Throwable $e) { /* broadcast failure must not fail the poll */ }

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

    /**
     * SSOT: list ONUs discovered via poll but not yet placed on topology
     * (is_unlinked=true OR splitter_output_id IS NULL).
     */
    public function unlinkedOnus(Request $request)
    {
        $rows = DB::table('fiber_onus as o')
            ->leftJoin('onu_live_status as l', function ($j) {
                $j->on('o.serial_number', '=', 'l.serial_number');
            })
            ->leftJoin('olt_devices as d', 'o.olt_device_id', '=', 'd.id')
            ->where(function ($q) {
                $q->where('o.is_unlinked', true)->orWhereNull('o.splitter_output_id');
            })
            ->when($request->olt_device_id, fn($q) => $q->where('o.olt_device_id', $request->olt_device_id))
            ->orderByDesc('o.discovered_at')
            ->limit(500)
            ->get([
                'o.id', 'o.serial_number', 'o.mac_address', 'o.olt_device_id',
                'o.pon_port_id', 'o.discovered_at', 'o.status as topology_status',
                'd.name as olt_name', 'l.status as live_status',
                'l.rx_power', 'l.tx_power', 'l.last_seen',
            ]);
        return response()->json($rows);
    }

    /**
     * SSOT: link an unlinked ONU to a splitter output (places it on topology).
     */
    public function linkOnu(Request $request, $onuId)
    {
        $data = $request->validate([
            'splitter_output_id' => 'required|uuid',
            'customer_id' => 'nullable|uuid',
        ]);
        $onu = \App\Models\FiberOnu::findOrFail($onuId);
        $onu->update([
            'splitter_output_id' => $data['splitter_output_id'],
            'customer_id' => $data['customer_id'] ?? $onu->customer_id,
            'is_unlinked' => false,
        ]);
        DB::table('fiber_splitter_outputs')
            ->where('id', $data['splitter_output_id'])
            ->update(['status' => 'used', 'connection_type' => 'onu', 'connected_id' => $onu->id]);
        return response()->json(['ok' => true, 'onu' => $onu]);
    }

    private function present(OltDevice $d): array
    {
        $fiberOlt = $d->fiber_olt_id ? FiberOlt::find($d->fiber_olt_id) : null;
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
            // SSOT topology mirror (read-only from fiber_olts master)
            'location' => $fiberOlt?->location,
            'lat' => $fiberOlt?->lat,
            'lng' => $fiberOlt?->lng,
            'total_pon_ports' => $fiberOlt?->total_pon_ports,
        ];
    }
}

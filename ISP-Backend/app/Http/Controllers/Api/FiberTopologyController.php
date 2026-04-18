<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FiberOlt;
use App\Models\FiberPonPort;
use App\Models\FiberCable;
use App\Models\FiberCore;
use App\Models\FiberSplitter;
use App\Models\FiberSplitterOutput;
use App\Models\FiberOnu;
use App\Models\CoreConnection;
use Illuminate\Http\Request;

class FiberTopologyController extends Controller
{
    private function applyAdminTenantContext(Request $request): ?string
    {
        $adminUser = $request->get('admin_user');
        $tenantId = $adminUser?->tenant_id ?: $request->get('__tenant_id') ?: tenant_id();

        if (!$tenantId) {
            return null;
        }

        $currentTenant = app()->bound('tenant') ? app('tenant') : null;

        if (!$currentTenant || $currentTenant->id !== $tenantId) {
            $tenant = \App\Models\Tenant::find($tenantId);
            if (!$tenant) {
                return null;
            }

            if (app()->bound('tenant')) {
                app()->forgetInstance('tenant');
            }

            if (app()->bound(\App\Models\Tenant::class)) {
                app()->forgetInstance(\App\Models\Tenant::class);
            }

            app()->instance('tenant', $tenant);
            app()->instance(\App\Models\Tenant::class, $tenant);
        }

        $request->attributes->set('__tenant_id', $tenantId);
        $request->merge(['__tenant_id' => $tenantId]);

        return $tenantId;
    }

    /**
     * Full topology tree - supports recursive splitter chaining
     */
    public function tree(Request $request)
    {
        try {
            $tenantId = $this->applyAdminTenantContext($request);
            if (!$tenantId) {
                return response()->json([]);
            }

            $olts = FiberOlt::query()
                ->where('tenant_id', $tenantId)
                ->with([
                    'ponPorts.cables.cores.splitter.outputs.onu.customer',
                    'ponPorts.cables.cores.connectedPort',
                ])
                ->latest('created_at')
                ->get();

            // Enrich outputs with chained children (fibers/splitters from outputs)
            $allOutputIds = [];
            $this->collectOutputIds($olts, $allOutputIds);

            if (!empty($allOutputIds)) {
                // Find cables sourced from splitter outputs
                $childCables = FiberCable::where('tenant_id', $tenantId)
                    ->where('source_type', 'splitter')
                    ->whereIn('source_id', $allOutputIds)
                    ->with('cores.splitter.outputs.onu.customer')
                    ->get()
                    ->groupBy('source_id');

                // Find splitters sourced from splitter outputs
                $childSplitters = FiberSplitter::where('tenant_id', $tenantId)
                    ->where('source_type', 'splitter_output')
                    ->whereIn('source_id', $allOutputIds)
                    ->with('outputs.onu.customer')
                    ->get()
                    ->keyBy('source_id');

                // Attach to outputs recursively (up to depth limit for safety)
                $this->attachChainedChildren($olts, $childCables, $childSplitters, $tenantId, 0);
            }

            return response()->json($olts);
        } catch (\Exception $e) {
            \Log::error('Fiber tree error: ' . $e->getMessage());
            return response()->json([], 200);
        }
    }

    private function collectOutputIds($items, &$ids)
    {
        foreach ($items as $item) {
            if (method_exists($item, 'ponPorts') && $item->relationLoaded('ponPorts')) {
                foreach ($item->ponPorts as $port) {
                    foreach ($port->cables as $cable) {
                        foreach ($cable->cores as $core) {
                            if ($core->splitter) {
                                foreach ($core->splitter->outputs as $output) {
                                    $ids[] = $output->id;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private function attachChainedChildren($olts, $childCables, $childSplitters, $tenantId, $depth)
    {
        if ($depth > 10) return; // Prevent infinite recursion

        foreach ($olts as $olt) {
            if (!$olt->relationLoaded('ponPorts')) continue;
            foreach ($olt->ponPorts as $port) {
                foreach ($port->cables as $cable) {
                    $this->enrichCableCores($cable, $childCables, $childSplitters, $tenantId, $depth);
                }
            }
        }
    }

    private function enrichCableCores($cable, $childCables, $childSplitters, $tenantId, $depth)
    {
        foreach ($cable->cores as $core) {
            if (!$core->splitter) continue;
            foreach ($core->splitter->outputs as $output) {
                // Attach child cables
                if (isset($childCables[$output->id])) {
                    $output->setAttribute('child_cables', $childCables[$output->id]);
                }
                // Attach child splitter
                if (isset($childSplitters[$output->id])) {
                    $output->setAttribute('child_splitter', $childSplitters[$output->id]);
                }
            }
        }
    }

    /**
     * Create OLT with GPS
     */
    public function storeOlt(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);

        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'total_pon_ports' => 'required|integer|min:1|max:64',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            // SSOT: optional live monitoring credentials (creates olt_devices row in same TX)
            'ip_address' => 'nullable|string|max:64',
            'vendor' => 'nullable|in:huawei,zte,vsol,bdcom',
            'connection_type' => 'nullable|in:api,cli,hybrid',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string|max:255',
            'port' => 'nullable|integer|min:1|max:65535',
            'api_port' => 'nullable|integer|min:1|max:65535',
        ]);

        if (!$tenantId) {
            return response()->json(['message' => 'Tenant context not found'], 422);
        }

        return \DB::transaction(function () use ($request, $tenantId) {
            $olt = FiberOlt::create([
                ...$request->only(['name', 'location', 'total_pon_ports', 'status', 'lat', 'lng']),
                'tenant_id' => $tenantId,
            ]);

            for ($i = 1; $i <= $request->total_pon_ports; $i++) {
                FiberPonPort::create([
                    'olt_id' => $olt->id,
                    'port_number' => $i,
                    'tenant_id' => $tenantId,
                ]);
            }

            // SSOT bridge: if credentials provided, create olt_devices row 1:1
            if ($request->filled('ip_address') && $request->filled('vendor')) {
                $vault = app(\App\Services\Fiber\CredentialVault::class);
                $device = new \App\Models\OltDevice();
                $device->fill([
                    'tenant_id' => $tenantId,
                    'fiber_olt_id' => $olt->id,
                    'name' => $request->name,
                    'ip_address' => $request->ip_address,
                    'port' => $request->input('port', 22),
                    'api_port' => $request->api_port,
                    'username' => $request->username,
                    'vendor' => $request->vendor,
                    'connection_type' => $request->input('connection_type', 'cli'),
                    'is_active' => true,
                ]);
                if ($request->filled('password')) {
                    $device->password_encrypted = $vault->encrypt($request->password, $tenantId);
                    $device->encryption_key_id = $vault->currentKeyId();
                }
                $device->save();
            }

            return response()->json($olt->load('ponPorts'), 201);
        });
    }

    /**
     * Create Fiber Cable - supports source from OLT PON port or Splitter Output
     */
    public function storeCable(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);

        $request->validate([
            'name' => 'required|string|max:255',
            'pon_port_id' => 'nullable|uuid',
            'source_type' => 'nullable|in:olt,core,splitter',
            'source_id' => 'nullable|uuid',
            'total_cores' => 'required|integer|min:1|max:144',
            'color' => 'nullable|string',
            'length_meters' => 'nullable|numeric',
            'cores' => 'nullable|array',
            'cores.*.number' => 'integer',
            'cores.*.color' => 'string',
        ]);

        if (!$tenantId) {
            return response()->json(['error' => 'Tenant context not found'], 422);
        }

        $sourceType = $request->input('source_type', 'olt');
        $sourceId = $request->input('source_id');

        // If source is splitter output, update the output status
        if ($sourceType === 'splitter' && $sourceId) {
            $output = FiberSplitterOutput::where('tenant_id', $tenantId)->findOrFail($sourceId);
            $output->update(['status' => 'used', 'connection_type' => 'fiber']);
        }

        $cable = FiberCable::create([
            ...$request->only([
                'name', 'pon_port_id', 'total_cores', 'color', 'length_meters', 'status',
            ]),
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'tenant_id' => $tenantId,
        ]);

        // Update the output's connected_id
        if ($sourceType === 'splitter' && $sourceId) {
            FiberSplitterOutput::where('tenant_id', $tenantId)
                ->where('id', $sourceId)
                ->update(['connected_id' => $cable->id]);
        }

        if ($request->has('cores') && is_array($request->cores)) {
            foreach ($request->cores as $core) {
                FiberCore::create([
                    'fiber_cable_id' => $cable->id,
                    'core_number' => $core['number'],
                    'color' => $core['color'] ?? null,
                    'tenant_id' => $tenantId,
                ]);
            }
        } else {
            $colors = ['Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White', 'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'];
            for ($i = 1; $i <= $request->total_cores; $i++) {
                FiberCore::create([
                    'fiber_cable_id' => $cable->id,
                    'core_number' => $i,
                    'color' => $colors[($i - 1) % count($colors)],
                    'tenant_id' => $tenantId,
                ]);
            }
        }

        return response()->json($cable->load('cores'), 201);
    }

    /**
     * Map core to OLT PON port
     */
    public function mapCoreToPort(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);

        $request->validate([
            'core_id' => 'required|uuid',
            'pon_port_id' => 'required|uuid',
        ]);

        $core = FiberCore::where('tenant_id', $tenantId)->findOrFail($request->core_id);
        $core->update(['connected_olt_port_id' => $request->pon_port_id]);

        return response()->json($core);
    }

    /**
     * Create core splice (cable-to-cable join)
     */
    public function storeSplice(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);

        $request->validate([
            'from_core_id' => 'required|uuid',
            'to_core_id' => 'required|uuid',
            'label' => 'nullable|string',
        ]);

        if (!$tenantId) {
            return response()->json(['error' => 'Tenant context not found'], 422);
        }

        if ($request->from_core_id === $request->to_core_id) {
            return response()->json(['error' => 'Cannot splice a core to itself.'], 422);
        }

        $existing = CoreConnection::where('tenant_id', $tenantId)
            ->where(function ($q) use ($request) {
                $q->where('from_core_id', $request->from_core_id)->where('to_core_id', $request->to_core_id);
            })->orWhere(function ($q) use ($request, $tenantId) {
                $q->where('tenant_id', $tenantId)
                  ->where('from_core_id', $request->to_core_id)
                  ->where('to_core_id', $request->from_core_id);
            })->first();

        if ($existing) {
            return response()->json(['error' => 'These cores are already spliced.'], 422);
        }

        $splice = CoreConnection::create([
            ...$request->only(['from_core_id', 'to_core_id', 'label']),
            'tenant_id' => $tenantId,
        ]);

        return response()->json($splice->load(['fromCore.cable', 'toCore.cable']), 201);
    }

    /**
     * List all splices
     */
    public function splices(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);
        if (!$tenantId) {
            return response()->json([]);
        }

        $splices = CoreConnection::where('tenant_id', $tenantId)
            ->with(['fromCore.cable', 'toCore.cable'])
            ->get();
        return response()->json($splices);
    }

    /**
     * Delete a splice
     */
    public function deleteSplice(Request $request, $id)
    {
        $tenantId = $this->applyAdminTenantContext($request);
        $splice = CoreConnection::where('tenant_id', $tenantId)->findOrFail($id);
        $splice->delete();
        return response()->json(['message' => 'Splice deleted']);
    }

    /**
     * Create Splitter - supports source from Core or Splitter Output
     */
    public function storeSplitter(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);

        $request->validate([
            'core_id' => 'nullable|uuid',
            'source_type' => 'nullable|in:core,splitter_output',
            'source_id' => 'nullable|uuid',
            'ratio' => 'required|in:1:2,1:4,1:8,1:16,1:32',
            'location' => 'nullable|string',
            'label' => 'nullable|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'output_colors' => 'nullable|array',
        ]);

        if (!$tenantId) {
            return response()->json(['error' => 'Tenant context not found'], 422);
        }

        $sourceType = $request->input('source_type', 'core');
        $sourceId = $request->input('source_id');
        $coreId = $request->input('core_id');

        // Validate: must have either core_id or source from splitter_output
        if (!$coreId && $sourceType !== 'splitter_output') {
            return response()->json(['error' => 'Either core_id or splitter_output source is required.'], 422);
        }

        // If from core, check existing
        if ($coreId) {
            $existing = FiberSplitter::where('tenant_id', $tenantId)->where('core_id', $coreId)->first();
            if ($existing) {
                return response()->json(['error' => 'This core already has a splitter assigned.'], 422);
            }

            $core = FiberCore::where('tenant_id', $tenantId)->findOrFail($coreId);
            $core->update(['status' => 'used']);
        }

        // If from splitter output, update the output
        if ($sourceType === 'splitter_output' && $sourceId) {
            $output = FiberSplitterOutput::where('tenant_id', $tenantId)->findOrFail($sourceId);
            $output->update(['status' => 'used', 'connection_type' => 'splitter']);
        }

        $splitter = FiberSplitter::create([
            ...$request->only([
                'core_id', 'ratio', 'location', 'label', 'status', 'lat', 'lng',
            ]),
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'tenant_id' => $tenantId,
        ]);

        // Update connected_id on the output
        if ($sourceType === 'splitter_output' && $sourceId) {
            FiberSplitterOutput::where('tenant_id', $tenantId)
                ->where('id', $sourceId)
                ->update(['connected_id' => $splitter->id]);
        }

        $outputCount = (int) explode(':', $request->ratio)[1];
        $defaultColors = ['Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White', 'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'];
        $outputColors = $request->output_colors ?? [];

        for ($i = 1; $i <= $outputCount; $i++) {
            FiberSplitterOutput::create([
                'splitter_id' => $splitter->id,
                'output_number' => $i,
                'color' => $outputColors[$i - 1] ?? $defaultColors[($i - 1) % count($defaultColors)],
                'tenant_id' => $tenantId,
            ]);
        }

        return response()->json($splitter->load('outputs'), 201);
    }

    /**
     * Assign ONU
     */
    public function storeOnu(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);

        $request->validate([
            'splitter_output_id' => 'required|uuid',
            'serial_number' => 'required|string',
            'mac_address' => 'nullable|string',
            'customer_id' => 'nullable|uuid',
        ]);

        if (!$tenantId) {
            return response()->json(['error' => 'Tenant context not found'], 422);
        }

        $existingOnu = FiberOnu::where('tenant_id', $tenantId)->where('splitter_output_id', $request->splitter_output_id)->first();
        if ($existingOnu) {
            return response()->json(['error' => 'This splitter output already has an ONU assigned.'], 422);
        }

        $output = FiberSplitterOutput::where('tenant_id', $tenantId)->findOrFail($request->splitter_output_id);
        $output->update(['status' => 'used', 'connection_type' => 'onu']);

        $onu = FiberOnu::create([
            ...$request->only([
                'splitter_output_id', 'serial_number', 'mac_address', 'customer_id', 'status', 'signal_strength',
            ]),
            'tenant_id' => $tenantId,
        ]);

        return response()->json($onu->load('customer'), 201);
    }

    /**
     * Search
     */
    public function search(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);
        $q = $request->input('q', '');
        if (!$tenantId || strlen($q) < 2) {
            return response()->json([]);
        }

        $results = [];

        $olts = FiberOlt::where('tenant_id', $tenantId)->where('name', 'like', "%{$q}%")->limit(5)->get();
        foreach ($olts as $olt) {
            $results[] = ['type' => 'OLT', 'id' => $olt->id, 'label' => $olt->name];
        }

        $cables = FiberCable::where('tenant_id', $tenantId)->where('name', 'like', "%{$q}%")->limit(5)->get();
        foreach ($cables as $cable) {
            $results[] = ['type' => 'Cable', 'id' => $cable->id, 'label' => $cable->name];
        }

        $cores = FiberCore::where('tenant_id', $tenantId)->where('color', 'like', "%{$q}%")->with('cable')->limit(5)->get();
        foreach ($cores as $core) {
            $results[] = ['type' => 'Core', 'id' => $core->id, 'label' => ($core->cable->name ?? '') . ' → Core ' . $core->core_number . ' (' . $core->color . ')'];
        }

        $onus = FiberOnu::where('tenant_id', $tenantId)
            ->where(function ($query) use ($q) {
                $query->where('serial_number', 'like', "%{$q}%")
                    ->orWhere('mac_address', 'like', "%{$q}%");
            })
            ->limit(5)
            ->get();
        foreach ($onus as $onu) {
            $results[] = ['type' => 'ONU', 'id' => $onu->id, 'label' => $onu->serial_number];
        }

        return response()->json($results);
    }

    /**
     * Stats
     */
    public function stats(Request $request)
    {
        try {
            $tenantId = $this->applyAdminTenantContext($request);
            if (!$tenantId) {
                return response()->json([
                    'total_olts' => 0, 'total_cables' => 0, 'total_cores' => 0,
                    'free_cores' => 0, 'used_cores' => 0, 'total_splitters' => 0,
                    'total_outputs' => 0, 'free_outputs' => 0, 'used_outputs' => 0,
                    'total_onus' => 0, 'total_splices' => 0,
                ]);
            }

            return response()->json([
                'total_olts' => FiberOlt::where('tenant_id', $tenantId)->count(),
                'total_cables' => FiberCable::where('tenant_id', $tenantId)->count(),
                'total_cores' => FiberCore::where('tenant_id', $tenantId)->count(),
                'free_cores' => FiberCore::where('tenant_id', $tenantId)->where('status', 'free')->count(),
                'used_cores' => FiberCore::where('tenant_id', $tenantId)->where('status', 'used')->count(),
                'total_splitters' => FiberSplitter::where('tenant_id', $tenantId)->count(),
                'total_outputs' => FiberSplitterOutput::where('tenant_id', $tenantId)->count(),
                'free_outputs' => FiberSplitterOutput::where('tenant_id', $tenantId)->where('status', 'free')->count(),
                'used_outputs' => FiberSplitterOutput::where('tenant_id', $tenantId)->where('status', 'used')->count(),
                'total_onus' => FiberOnu::where('tenant_id', $tenantId)->count(),
                'total_splices' => CoreConnection::where('tenant_id', $tenantId)->count(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Fiber stats error: ' . $e->getMessage());
            return response()->json([
                'total_olts' => 0, 'total_cables' => 0, 'total_cores' => 0,
                'free_cores' => 0, 'used_cores' => 0, 'total_splitters' => 0,
                'total_outputs' => 0, 'free_outputs' => 0, 'used_outputs' => 0,
                'total_onus' => 0, 'total_splices' => 0,
            ]);
        }
    }

    /**
     * Map markers for OLTs and Splitters with GPS
     */
    public function mapData(Request $request)
    {
        $tenantId = $this->applyAdminTenantContext($request);
        if (!$tenantId) {
            return response()->json([]);
        }

        $markers = [];

        $olts = FiberOlt::where('tenant_id', $tenantId)->whereNotNull('lat')->whereNotNull('lng')->get();
        foreach ($olts as $olt) {
            $markers[] = [
                'id' => $olt->id,
                'type' => 'olt',
                'name' => $olt->name,
                'lat' => $olt->lat,
                'lng' => $olt->lng,
            ];
        }

        $splitters = FiberSplitter::where('tenant_id', $tenantId)->whereNotNull('lat')->whereNotNull('lng')->with('core.cable')->get();
        foreach ($splitters as $sp) {
            $markers[] = [
                'id' => $sp->id,
                'type' => 'splitter',
                'name' => ($sp->label ?: 'Splitter') . ' (' . $sp->ratio . ')',
                'lat' => $sp->lat,
                'lng' => $sp->lng,
                'cable' => $sp->core->cable->name ?? null,
            ];
        }

        return response()->json($markers);
    }
}

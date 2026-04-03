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
    /**
     * Full topology tree
     */
    public function tree(Request $request)
    {
        $olts = FiberOlt::with([
            'ponPorts.cables.cores.splitter.outputs.onu.customer',
            'ponPorts.cables.cores.connectedPort',
            'ponPorts.cables.cores.spliceFrom.toCore.cable',
            'ponPorts.cables.cores.spliceTo.fromCore.cable',
        ])->orderBy('name')->get();

        return response()->json($olts);
    }

    /**
     * Create OLT with GPS
     */
    public function storeOlt(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'total_pon_ports' => 'required|integer|min:1|max:64',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
        ]);

        $olt = FiberOlt::create($request->only(['name', 'location', 'total_pon_ports', 'status', 'lat', 'lng']));

        for ($i = 1; $i <= $request->total_pon_ports; $i++) {
            FiberPonPort::create([
                'olt_id' => $olt->id,
                'port_number' => $i,
                'tenant_id' => $olt->tenant_id,
            ]);
        }

        return response()->json($olt->load('ponPorts'), 201);
    }

    /**
     * Create Fiber Cable with colored cores
     */
    public function storeCable(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'pon_port_id' => 'nullable|uuid',
            'total_cores' => 'required|integer|min:1|max:144',
            'color' => 'nullable|string',
            'length_meters' => 'nullable|numeric',
            'cores' => 'nullable|array',
            'cores.*.number' => 'integer',
            'cores.*.color' => 'string',
        ]);

        $cable = FiberCable::create($request->only([
            'name', 'pon_port_id', 'total_cores', 'color', 'length_meters', 'status',
        ]));

        if ($request->has('cores') && is_array($request->cores)) {
            foreach ($request->cores as $core) {
                FiberCore::create([
                    'fiber_cable_id' => $cable->id,
                    'core_number' => $core['number'],
                    'color' => $core['color'] ?? null,
                    'tenant_id' => $cable->tenant_id,
                ]);
            }
        } else {
            $colors = ['Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White', 'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'];
            for ($i = 1; $i <= $request->total_cores; $i++) {
                FiberCore::create([
                    'fiber_cable_id' => $cable->id,
                    'core_number' => $i,
                    'color' => $colors[($i - 1) % count($colors)],
                    'tenant_id' => $cable->tenant_id,
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
        $request->validate([
            'core_id' => 'required|uuid',
            'pon_port_id' => 'required|uuid',
        ]);

        $core = FiberCore::findOrFail($request->core_id);
        $core->update(['connected_olt_port_id' => $request->pon_port_id]);

        return response()->json($core);
    }

    /**
     * Create core splice (cable-to-cable join)
     */
    public function storeSplice(Request $request)
    {
        $request->validate([
            'from_core_id' => 'required|uuid',
            'to_core_id' => 'required|uuid',
            'label' => 'nullable|string',
        ]);

        if ($request->from_core_id === $request->to_core_id) {
            return response()->json(['error' => 'Cannot splice a core to itself.'], 422);
        }

        $existing = CoreConnection::where(function ($q) use ($request) {
            $q->where('from_core_id', $request->from_core_id)->where('to_core_id', $request->to_core_id);
        })->orWhere(function ($q) use ($request) {
            $q->where('from_core_id', $request->to_core_id)->where('to_core_id', $request->from_core_id);
        })->first();

        if ($existing) {
            return response()->json(['error' => 'These cores are already spliced.'], 422);
        }

        $splice = CoreConnection::create($request->only(['from_core_id', 'to_core_id', 'label']));

        return response()->json($splice->load(['fromCore.cable', 'toCore.cable']), 201);
    }

    /**
     * List all splices
     */
    public function splices()
    {
        $splices = CoreConnection::with(['fromCore.cable', 'toCore.cable'])->get();
        return response()->json($splices);
    }

    /**
     * Delete a splice
     */
    public function deleteSplice($id)
    {
        $splice = CoreConnection::findOrFail($id);
        $splice->delete();
        return response()->json(['message' => 'Splice deleted']);
    }

    /**
     * Create Splitter with GPS
     */
    public function storeSplitter(Request $request)
    {
        $request->validate([
            'core_id' => 'required|uuid',
            'ratio' => 'required|in:1:2,1:4,1:8,1:16,1:32',
            'location' => 'nullable|string',
            'label' => 'nullable|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'output_colors' => 'nullable|array',
        ]);

        $existing = FiberSplitter::where('core_id', $request->core_id)->first();
        if ($existing) {
            return response()->json(['error' => 'This core already has a splitter assigned.'], 422);
        }

        $core = FiberCore::findOrFail($request->core_id);
        $core->update(['status' => 'used']);

        $splitter = FiberSplitter::create($request->only([
            'core_id', 'ratio', 'location', 'label', 'status', 'lat', 'lng',
        ]));

        $outputCount = (int) explode(':', $request->ratio)[1];
        $defaultColors = ['Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White', 'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'];
        $outputColors = $request->output_colors ?? [];

        for ($i = 1; $i <= $outputCount; $i++) {
            FiberSplitterOutput::create([
                'splitter_id' => $splitter->id,
                'output_number' => $i,
                'color' => $outputColors[$i - 1] ?? $defaultColors[($i - 1) % count($defaultColors)],
                'tenant_id' => $splitter->tenant_id,
            ]);
        }

        return response()->json($splitter->load('outputs'), 201);
    }

    /**
     * Assign ONU
     */
    public function storeOnu(Request $request)
    {
        $request->validate([
            'splitter_output_id' => 'required|uuid',
            'serial_number' => 'required|string',
            'mac_address' => 'nullable|string',
            'customer_id' => 'nullable|uuid',
        ]);

        $existingOnu = FiberOnu::where('splitter_output_id', $request->splitter_output_id)->first();
        if ($existingOnu) {
            return response()->json(['error' => 'This splitter output already has an ONU assigned.'], 422);
        }

        $output = FiberSplitterOutput::findOrFail($request->splitter_output_id);
        $output->update(['status' => 'used', 'connection_type' => 'onu']);

        $onu = FiberOnu::create($request->only([
            'splitter_output_id', 'serial_number', 'mac_address', 'customer_id', 'status', 'signal_strength',
        ]));

        return response()->json($onu->load('customer'), 201);
    }

    /**
     * Search
     */
    public function search(Request $request)
    {
        $q = $request->input('q', '');
        if (strlen($q) < 2) {
            return response()->json([]);
        }

        $results = [];

        $olts = FiberOlt::where('name', 'like', "%{$q}%")->limit(5)->get();
        foreach ($olts as $olt) {
            $results[] = ['type' => 'OLT', 'id' => $olt->id, 'label' => $olt->name];
        }

        $cables = FiberCable::where('name', 'like', "%{$q}%")->limit(5)->get();
        foreach ($cables as $cable) {
            $results[] = ['type' => 'Cable', 'id' => $cable->id, 'label' => $cable->name];
        }

        // Search by core color
        $cores = FiberCore::where('color', 'like', "%{$q}%")->with('cable')->limit(5)->get();
        foreach ($cores as $core) {
            $results[] = ['type' => 'Core', 'id' => $core->id, 'label' => ($core->cable->name ?? '') . ' → Core ' . $core->core_number . ' (' . $core->color . ')'];
        }

        $onus = FiberOnu::where('serial_number', 'like', "%{$q}%")
            ->orWhere('mac_address', 'like', "%{$q}%")
            ->limit(5)->get();
        foreach ($onus as $onu) {
            $results[] = ['type' => 'ONU', 'id' => $onu->id, 'label' => $onu->serial_number];
        }

        return response()->json($results);
    }

    /**
     * Stats
     */
    public function stats()
    {
        return response()->json([
            'total_olts' => FiberOlt::count(),
            'total_cables' => FiberCable::count(),
            'total_cores' => FiberCore::count(),
            'free_cores' => FiberCore::where('status', 'free')->count(),
            'used_cores' => FiberCore::where('status', 'used')->count(),
            'total_splitters' => FiberSplitter::count(),
            'total_outputs' => FiberSplitterOutput::count(),
            'free_outputs' => FiberSplitterOutput::where('status', 'free')->count(),
            'used_outputs' => FiberSplitterOutput::where('status', 'used')->count(),
            'total_onus' => FiberOnu::count(),
            'total_splices' => CoreConnection::count(),
        ]);
    }

    /**
     * Map markers for OLTs and Splitters with GPS
     */
    public function mapData()
    {
        $markers = [];

        $olts = FiberOlt::whereNotNull('lat')->whereNotNull('lng')->get();
        foreach ($olts as $olt) {
            $markers[] = [
                'id' => $olt->id,
                'type' => 'olt',
                'name' => $olt->name,
                'lat' => $olt->lat,
                'lng' => $olt->lng,
            ];
        }

        $splitters = FiberSplitter::whereNotNull('lat')->whereNotNull('lng')->with('core.cable')->get();
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

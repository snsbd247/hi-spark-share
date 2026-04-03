<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NetworkLink;
use Illuminate\Http\Request;

class NetworkLinkController extends Controller
{
    public function index()
    {
        return response()->json(
            NetworkLink::with(['fromNode:id,name,lat,lng', 'toNode:id,name,lat,lng'])->get()
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'from_node_id' => 'required|uuid|exists:network_nodes,id',
            'to_node_id' => 'required|uuid|exists:network_nodes,id|different:from_node_id',
        ]);

        $link = NetworkLink::create($request->only([
            'from_node_id', 'to_node_id', 'link_type', 'label',
        ]));

        return response()->json($link->load(['fromNode:id,name,lat,lng', 'toNode:id,name,lat,lng']), 201);
    }

    public function destroy($id)
    {
        $link = NetworkLink::findOrFail($id);
        $link->delete();

        return response()->json(['message' => 'Link deleted']);
    }
}

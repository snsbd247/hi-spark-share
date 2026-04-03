<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NetworkNode;
use Illuminate\Http\Request;

class NetworkNodeController extends Controller
{
    public function index(Request $request)
    {
        $query = NetworkNode::query();

        if ($request->type) {
            $query->where('type', $request->type);
        }
        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:olt,splitter,onu,customer,router,switch',
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);

        $node = NetworkNode::create($request->only([
            'name', 'type', 'lat', 'lng', 'parent_id', 'status', 'device_id', 'metadata',
        ]));

        return response()->json($node, 201);
    }

    public function update(Request $request, $id)
    {
        $node = NetworkNode::findOrFail($id);

        $node->update($request->only([
            'name', 'type', 'lat', 'lng', 'parent_id', 'status', 'device_id', 'metadata',
        ]));

        return response()->json($node);
    }

    public function destroy($id)
    {
        $node = NetworkNode::findOrFail($id);
        $node->delete();

        return response()->json(['message' => 'Node deleted']);
    }
}

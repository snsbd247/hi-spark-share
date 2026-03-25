<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\Request;

class VendorController extends Controller
{
    public function index(Request $request)
    {
        $query = Vendor::query();

        if ($request->has('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%")
                  ->orWhere('company', 'like', "%{$s}%");
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 50))
        );
    }

    public function show(string $id)
    {
        $vendor = Vendor::with('purchases')->findOrFail($id);
        return response()->json($vendor);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'    => 'required|string|max:255',
            'phone'   => 'nullable|string|max:20',
            'email'   => 'nullable|email|max:255',
            'company' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:500',
        ]);

        $vendor = Vendor::create($request->only([
            'name', 'phone', 'email', 'company', 'address', 'notes',
        ]));

        return response()->json($vendor, 201);
    }

    public function update(Request $request, string $id)
    {
        $vendor = Vendor::findOrFail($id);
        $vendor->update($request->only([
            'name', 'phone', 'email', 'company', 'address', 'status', 'notes',
        ]));

        return response()->json($vendor);
    }

    public function destroy(string $id)
    {
        $vendor = Vendor::findOrFail($id);
        if ($vendor->purchases()->exists()) {
            return response()->json(['error' => 'Cannot delete vendor with purchases'], 422);
        }
        $vendor->delete();
        return response()->json(['success' => true]);
    }
}

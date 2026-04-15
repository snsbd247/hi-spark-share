<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

/**
 * VendorController is a legacy alias for SupplierController.
 * The "vendors" module was removed and absorbed into "suppliers".
 */
class VendorController extends Controller
{
    public function index(Request $request)
    {
        $query = Supplier::query();

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
        return response()->json(Supplier::findOrFail($id));
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

        $vendor = Supplier::create($request->only([
            'name', 'phone', 'email', 'company', 'address',
        ]));

        return response()->json($vendor, 201);
    }

    public function update(Request $request, string $id)
    {
        $vendor = Supplier::findOrFail($id);
        $vendor->update($request->only([
            'name', 'phone', 'email', 'company', 'address', 'status',
        ]));

        return response()->json($vendor);
    }

    public function destroy(string $id)
    {
        Supplier::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}

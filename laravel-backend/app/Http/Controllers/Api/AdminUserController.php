<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminUserController extends Controller
{
    public function index()
    {
        $profiles = Profile::with('roles')->orderBy('created_at', 'desc')->get();
        return response()->json($profiles->map(function ($p) {
            $role = $p->roles->first();
            return [
                'id' => $p->id,
                'full_name' => $p->full_name,
                'email' => $p->email,
                'username' => $p->username,
                'mobile' => $p->mobile,
                'status' => $p->status,
                'avatar_url' => $p->avatar_url,
                'role' => $role->role ?? 'staff',
                'custom_role_id' => $role->custom_role_id ?? null,
                'created_at' => $p->created_at,
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'full_name' => 'required|string',
            'email' => 'required|email|unique:profiles,email',
            'password' => 'required|string|min:6',
            'role' => 'required|string',
        ]);

        $profile = Profile::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'username' => $request->username,
            'mobile' => $request->mobile,
            'password_hash' => Hash::make($request->password),
        ]);

        UserRole::create([
            'user_id' => $profile->id,
            'role' => $request->role,
            'custom_role_id' => $request->custom_role_id,
        ]);

        return response()->json($profile, 201);
    }

    public function update(Request $request, string $id)
    {
        $profile = Profile::findOrFail($id);

        $data = $request->only(['full_name', 'email', 'username', 'mobile', 'status', 'avatar_url']);
        if ($request->has('password') && $request->password) {
            $data['password_hash'] = Hash::make($request->password);
        }

        $profile->update($data);

        if ($request->has('role')) {
            UserRole::updateOrCreate(
                ['user_id' => $profile->id],
                ['role' => $request->role, 'custom_role_id' => $request->custom_role_id]
            );
        }

        return response()->json($profile);
    }

    public function destroy(string $id)
    {
        Profile::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminLoginRequest;
use App\Models\AdminLoginLog;
use App\Models\AdminSession;
use App\Models\User;
use App\Models\UserRole;
use App\Models\RolePermission;
use App\Models\CustomRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(AdminLoginRequest $request)
    {
        $user = User::where('email', $request->email)
            ->orWhere('username', $request->email)
            ->first();

        if (!$user || !$user->password_hash || !Hash::check($request->password, $user->password_hash)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['error' => 'Account is disabled'], 403);
        }

        $role = UserRole::where('user_id', $user->id)->first();

        // Get permissions for custom role
        $permissions = [];
        if ($role && $role->custom_role_id) {
            $customRole = CustomRole::with('permissions')->find($role->custom_role_id);
            if ($customRole) {
                $permissions = $customRole->permissions->map(fn($p) => [
                    'module' => $p->module,
                    'action' => $p->action,
                ])->toArray();
            }
        }

        $sessionToken = Str::uuid()->toString();
        $session = AdminSession::create([
            'admin_id' => $user->id,
            'session_token' => $sessionToken,
            'ip_address' => $request->ip(),
            'browser' => $request->header('User-Agent', ''),
            'device_name' => $request->input('device_name', 'Unknown'),
        ]);

        AdminLoginLog::create([
            'admin_id' => $user->id,
            'action' => 'login',
            'ip_address' => $request->ip(),
            'browser' => $request->header('User-Agent', ''),
            'session_id' => $session->id,
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->full_name,
                'username' => $user->username,
                'role' => $role->role ?? 'staff',
                'custom_role_id' => $role->custom_role_id ?? null,
                'avatar_url' => $user->avatar_url,
                'mobile' => $user->mobile,
                'language' => $user->language ?? 'en',
                'permissions' => $permissions,
            ],
            'token' => $sessionToken,
        ]);
    }

    public function logout(Request $request)
    {
        $session = $request->get('admin_session');

        if ($session) {
            AdminLoginLog::create([
                'admin_id' => $session->admin_id,
                'action' => 'logout',
                'ip_address' => $request->ip(),
                'browser' => $request->header('User-Agent', ''),
                'session_id' => $session->id,
            ]);

            $session->update(['status' => 'expired']);
        }

        return response()->json(['success' => true]);
    }

    public function me(Request $request)
    {
        $admin = $request->get('admin_user');
        $role = UserRole::where('user_id', $admin->id)->first();

        $permissions = [];
        if ($role && $role->custom_role_id) {
            $customRole = CustomRole::with('permissions')->find($role->custom_role_id);
            if ($customRole) {
                $permissions = $customRole->permissions->map(fn($p) => [
                    'module' => $p->module,
                    'action' => $p->action,
                ])->toArray();
            }
        }

        return response()->json([
            'id' => $admin->id,
            'email' => $admin->email,
            'name' => $admin->full_name,
            'username' => $admin->username,
            'role' => $role->role ?? 'staff',
            'custom_role_id' => $role->custom_role_id ?? null,
            'avatar_url' => $admin->avatar_url,
            'mobile' => $admin->mobile,
            'staff_id' => $admin->staff_id,
            'address' => $admin->address,
            'language' => $admin->language ?? 'en',
            'permissions' => $permissions,
        ]);
    }

    public function updateProfile(Request $request)
    {
        $admin = $request->get('admin_user');

        $data = $request->only(['full_name', 'mobile', 'address', 'avatar_url', 'language']);

        if ($request->has('current_password') && $request->has('new_password')) {
            if (!Hash::check($request->current_password, $admin->password_hash)) {
                return response()->json(['error' => 'Current password is incorrect'], 422);
            }
            $data['password_hash'] = Hash::make($request->new_password);
        }

        $admin->update($data);

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $admin->id,
                'email' => $admin->email,
                'name' => $admin->full_name,
                'avatar_url' => $admin->avatar_url,
                'language' => $admin->language ?? 'en',
            ],
        ]);
    }
}

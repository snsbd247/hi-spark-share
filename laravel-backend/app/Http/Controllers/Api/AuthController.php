<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLoginLog;
use App\Models\AdminSession;
use App\Models\Profile;
use App\Models\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string',
            'password' => 'required|string',
        ]);

        $profile = Profile::where('email', $request->email)
            ->orWhere('username', $request->email)
            ->first();

        if (!$profile || !$profile->password_hash || !Hash::check($request->password, $profile->password_hash)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        if ($profile->status !== 'active') {
            return response()->json(['error' => 'Account is disabled'], 403);
        }

        // Get role
        $role = UserRole::where('user_id', $profile->id)->first();

        // Create session
        $sessionToken = Str::uuid()->toString();
        $session = AdminSession::create([
            'admin_id' => $profile->id,
            'session_token' => $sessionToken,
            'ip_address' => $request->ip(),
            'browser' => $request->header('User-Agent', ''),
            'device_name' => $request->input('device_name', 'Unknown'),
        ]);

        // Log login
        AdminLoginLog::create([
            'admin_id' => $profile->id,
            'action' => 'login',
            'ip_address' => $request->ip(),
            'browser' => $request->header('User-Agent', ''),
            'session_id' => $session->id,
        ]);

        return response()->json([
            'user' => [
                'id' => $profile->id,
                'email' => $profile->email,
                'name' => $profile->full_name,
                'role' => $role->role ?? 'staff',
                'avatar_url' => $profile->avatar_url,
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

        return response()->json([
            'id' => $admin->id,
            'email' => $admin->email,
            'name' => $admin->full_name,
            'role' => $role->role ?? 'staff',
            'avatar_url' => $admin->avatar_url,
        ]);
    }
}

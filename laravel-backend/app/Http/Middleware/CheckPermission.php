<?php

namespace App\Http\Middleware;

use App\Models\CustomRole;
use App\Models\UserRole;
use Closure;
use Illuminate\Http\Request;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $module, string $action)
    {
        $admin = $request->get('admin_user');

        if (!$admin) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roles = UserRole::where('user_id', $admin->id)->get();

        // Super admin bypasses all checks
        if ($roles->contains('role', 'super_admin')) {
            return $next($request);
        }

        // Check custom role permissions
        foreach ($roles as $role) {
            if ($role->custom_role_id) {
                $customRole = CustomRole::with('permissions')->find($role->custom_role_id);
                if ($customRole) {
                    $hasPermission = $customRole->permissions
                        ->where('module', $module)
                        ->where('action', $action)
                        ->isNotEmpty();

                    if ($hasPermission) {
                        return $next($request);
                    }
                }
            }
        }

        return response()->json(['error' => 'Insufficient permissions'], 403);
    }
}

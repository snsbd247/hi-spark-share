<?php

namespace App\Http\Middleware;

use App\Models\CustomRole;
use App\Models\UserRole;
use App\Support\Auth\AdminContext;
use Closure;
use Illuminate\Http\Request;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $module, string $action)
    {
        $admin = AdminContext::user($request);

        if (!$admin) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (AdminContext::isSuperAdmin($admin)) {
            return $next($request);
        }

        $adminId = AdminContext::id($admin);
        if (!$adminId) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roles = UserRole::where('user_id', $adminId)->get();

        if ($roles->contains('role', 'super_admin') || $roles->contains('role', 'admin') || $roles->contains('role', 'owner')) {
            return $next($request);
        }

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

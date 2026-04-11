<?php

namespace App\Http\Middleware;

use App\Services\PlanModuleService;
use App\Support\Auth\AdminContext;
use Closure;
use Illuminate\Http\Request;

class CheckPlanModule
{
    /**
     * Check if the current tenant's plan allows access to the requested module.
     *
     * Usage in routes: ->middleware('check.plan_module:accounting')
     */
    public function handle(Request $request, Closure $next, string $module)
    {
        $tenant = tenant();
        $admin = AdminContext::user($request);

        if ($admin) {
            if (AdminContext::isSuperAdmin($admin)) {
                return $next($request);
            }

            $adminId = AdminContext::id($admin);
            if ($adminId) {
                $roles = \App\Models\UserRole::where('user_id', $adminId)->pluck('role');
                if ($roles->contains('owner') || $roles->contains('super_admin') || $roles->contains('admin')) {
                    return $next($request);
                }
            }
        }

        if (!$tenant) {
            return $next($request);
        }

        if (!PlanModuleService::isModuleAllowed($tenant->id, $module)) {
            return response()->json([
                'error' => 'Module not available',
                'message' => "The '{$module}' module is not included in your subscription plan. Please upgrade your plan to access this feature.",
                'module' => $module,
            ], 403);
        }

        return $next($request);
    }
}

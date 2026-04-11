<?php

namespace App\Support\Auth;

use Illuminate\Http\Request;

final class AdminContext
{
    public static function user(Request $request): mixed
    {
        return $request->attributes->get('admin_user')
            ?? $request->attributes->get('admin_user_object')
            ?? $request->get('admin_user');
    }

    public static function id(mixed $admin): ?string
    {
        if (is_array($admin)) {
            return $admin['id'] ?? null;
        }

        return is_object($admin) ? ($admin->id ?? null) : null;
    }

    public static function isSuperAdmin(mixed $admin): bool
    {
        if (is_array($admin)) {
            return (bool) ($admin['is_super_admin'] ?? false);
        }

        return is_object($admin) ? (bool) ($admin->is_super_admin ?? false) : false;
    }
}

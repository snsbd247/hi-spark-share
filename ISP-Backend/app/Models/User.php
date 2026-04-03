<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'users';

    protected $fillable = [
        'id', 'tenant_id', 'full_name', 'email', 'username', 'mobile', 'address',
        'avatar_url', 'password_hash', 'staff_id', 'status', 'language',
        'must_change_password',
    ];

    protected $casts = [
        'must_change_password' => 'boolean',
    ];

    protected $hidden = ['password_hash'];

    public function roles()
    {
        return $this->hasMany(UserRole::class, 'user_id');
    }

    public function sessions()
    {
        return $this->hasMany(AdminSession::class, 'admin_id');
    }

    /**
     * Check if the user has a specific permission via their assigned role.
     * Super Admin, Admin, and Owner bypass all permission checks.
     */
    public function hasPermission(string $slug): bool
    {
        $roles = $this->roles()->get();

        // Super admin, admin, and owner bypass all checks
        foreach ($roles as $role) {
            if (in_array($role->role, ['super_admin', 'admin', 'owner'])) {
                return true;
            }
        }

        // Check custom role permissions
        [$module, $action] = explode('.', $slug, 2);

        foreach ($roles as $role) {
            if ($role->custom_role_id) {
                $customRole = CustomRole::with('permissions')->find($role->custom_role_id);
                if ($customRole) {
                    $hasPermission = $customRole->permissions
                        ->where('module', $module)
                        ->where('action', $action)
                        ->isNotEmpty();

                    if ($hasPermission) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Get the user's primary role name (db_role value).
     */
    public function getPrimaryRole(): ?string
    {
        return $this->roles()->first()?->role;
    }
}

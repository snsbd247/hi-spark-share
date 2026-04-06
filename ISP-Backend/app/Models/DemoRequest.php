<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class DemoRequest extends Model
{
    use HasUuid;

    protected $table = 'demo_requests';

    protected $fillable = [
        'id', 'company_name', 'contact_name', 'email', 'phone', 'message',
        'status', 'notes', 'subdomain', 'tenant_id', 'approved_at', 'approved_by',
        'approved_modules', 'expires_at',
    ];

    protected $casts = [
        'approved_modules' => 'array',
        'approved_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}

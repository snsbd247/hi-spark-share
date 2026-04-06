<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CustomerResellerMigration extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'customer_reseller_migrations';

    public $timestamps = false;

    protected $fillable = [
        'id', 'tenant_id', 'customer_id', 'old_reseller_id', 'new_reseller_id',
        'reason', 'changed_by', 'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function oldReseller()
    {
        return $this->belongsTo(Reseller::class, 'old_reseller_id');
    }

    public function newReseller()
    {
        return $this->belongsTo(Reseller::class, 'new_reseller_id');
    }
}

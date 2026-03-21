<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CustomerSession extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'customer_id', 'session_token', 'expires_at'];

    protected $casts = ['expires_at' => 'datetime'];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}

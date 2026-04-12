<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class PlanModule extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = ['id', 'plan_id', 'module_id'];

    public function plan()
    {
        return $this->belongsTo(SaasPlan::class, 'plan_id');
    }

    public function module()
    {
        return $this->belongsTo(Module::class);
    }

    /**
     * Alias for Supabase-compatible relation name (table name = modules).
     */
    public function modules()
    {
        return $this->belongsTo(Module::class, 'module_id');
    }
}

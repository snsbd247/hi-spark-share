<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class LandingSection extends Model
{
    use HasUuid;

    protected $table = 'landing_sections';

    protected $fillable = [
        'id', 'section_type', 'title', 'subtitle', 'content', 'image_url',
        'button_text', 'button_url', 'sort_order', 'is_active', 'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'metadata' => 'array',
    ];
}

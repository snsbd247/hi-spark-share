<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class TenantCompanyInfo extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'tenant_company_info';

    protected $fillable = [
        'id', 'tenant_id', 'company_name', 'address', 'phone',
        'email', 'website', 'logo_url', 'footer_text',
        'invoice_prefix', 'invoice_notes', 'tax_id', 'registration_no',
    ];
}

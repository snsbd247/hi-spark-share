<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class SmtpSetting extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'smtp_settings';

    protected $fillable = [
        'id', 'tenant_id', 'host', 'port', 'username', 'password', 'encryption',
        'from_email', 'from_name', 'status',
    ];

    protected $hidden = ['password'];

    // Encrypt password on set
    public function setPasswordAttribute($value)
    {
        if ($value) {
            $this->attributes['password'] = Crypt::encryptString($value);
        }
    }

    // Decrypt password on get
    public function getDecryptedPasswordAttribute(): ?string
    {
        try {
            return $this->attributes['password'] ? Crypt::decryptString($this->attributes['password']) : null;
        } catch (\Exception $e) {
            return $this->attributes['password'] ?? null;
        }
    }
}

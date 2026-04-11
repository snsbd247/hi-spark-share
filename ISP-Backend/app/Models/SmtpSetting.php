<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class SmtpSetting extends Model
{
    use HasUuid;

    protected $table = 'smtp_settings';

    protected $fillable = [
        'id', 'host', 'port', 'username', 'password', 'encryption',
        'from_email', 'from_name', 'status',
    ];

    protected $hidden = ['password'];

    // Encrypt password on set
    public function setPasswordAttribute($value)
    {
        if ($value === null || $value === '') {
            return;
        }

        try {
            $this->attributes['password'] = Crypt::encryptString((string) $value);
        } catch (\Throwable $e) {
            Log::warning('SMTP password encryption failed, storing raw password fallback', [
                'message' => $e->getMessage(),
            ]);
            $this->attributes['password'] = (string) $value;
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

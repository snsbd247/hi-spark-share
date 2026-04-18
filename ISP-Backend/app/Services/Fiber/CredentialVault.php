<?php

namespace App\Services\Fiber;

use Illuminate\Support\Facades\Log;

/**
 * AES-256-GCM credential vault with per-tenant key derivation and rotation support.
 *
 * Design:
 *   - Master key sources (priority): env('FIBER_VAULT_MASTER_KEY') -> env('APP_KEY') hash
 *   - Per-tenant key = HKDF-SHA256(master, salt = "fiber-vault|tenant_id|key_id")
 *   - Stored ciphertext format: base64( key_id(8) | iv(12) | tag(16) | ciphertext )
 *   - encryption_key_id column tracks which key version encrypted the row → rotation safe.
 *
 * SAFETY: This service is fully isolated. It is NEVER called from Email/SMS/Payment/MikroTik code.
 */
class CredentialVault
{
    private const CURRENT_KEY_ID = 'v1';
    private const CIPHER = 'aes-256-gcm';

    public function encrypt(?string $plaintext, ?string $tenantId = null): ?string
    {
        if ($plaintext === null || $plaintext === '') {
            return null;
        }
        $keyId = self::CURRENT_KEY_ID;
        $key = $this->deriveKey($tenantId, $keyId);
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
        if ($cipher === false) {
            throw new \RuntimeException('Vault encryption failed');
        }
        return base64_encode(str_pad($keyId, 8, "\0") . $iv . $tag . $cipher);
    }

    public function decrypt(?string $payload, ?string $tenantId = null): ?string
    {
        if ($payload === null || $payload === '') {
            return null;
        }
        try {
            $raw = base64_decode($payload, true);
            if ($raw === false || strlen($raw) < 8 + 12 + 16 + 1) {
                return null;
            }
            $keyId = trim(substr($raw, 0, 8), "\0");
            $iv = substr($raw, 8, 12);
            $tag = substr($raw, 20, 16);
            $cipher = substr($raw, 36);
            $key = $this->deriveKey($tenantId, $keyId ?: self::CURRENT_KEY_ID);
            $plain = openssl_decrypt($cipher, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag);
            return $plain === false ? null : $plain;
        } catch (\Throwable $e) {
            Log::warning('CredentialVault decrypt failed: ' . $e->getMessage());
            return null;
        }
    }

    public function currentKeyId(): string
    {
        return self::CURRENT_KEY_ID;
    }

    /**
     * Mask a string for safe logging (keeps first/last char only).
     */
    public static function mask(?string $s): string
    {
        if ($s === null || $s === '') return '';
        $len = strlen($s);
        if ($len <= 2) return str_repeat('*', $len);
        return $s[0] . str_repeat('*', max(3, $len - 2)) . $s[$len - 1];
    }

    private function deriveKey(?string $tenantId, string $keyId): string
    {
        $master = (string) (env('FIBER_VAULT_MASTER_KEY') ?: env('APP_KEY', ''));
        if (str_starts_with($master, 'base64:')) {
            $decoded = base64_decode(substr($master, 7), true);
            if ($decoded !== false) $master = $decoded;
        }
        $salt = 'fiber-vault|' . ($tenantId ?? 'global') . '|' . $keyId;
        // HKDF-SHA256 (PHP 7.1.2+)
        return hash_hkdf('sha256', $master, 32, $salt, '');
    }
}

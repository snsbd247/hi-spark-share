<?php

namespace App\Services\Fiber;

use App\Models\OltDevice;
use App\Models\OltPollingLog;
use App\Services\Fiber\Adapters\BdcomOltAdapter;
use App\Services\Fiber\Adapters\HuaweiOltAdapter;
use App\Services\Fiber\Adapters\OltAdapterInterface;
use App\Services\Fiber\Adapters\VsolOltAdapter;
use App\Services\Fiber\Adapters\ZteOltAdapter;

/**
 * Hybrid connector.
 *  - Resolves vendor adapter
 *  - Tries API path first (placeholder — vendor REST when implemented)
 *  - Falls back to CLI/SSH parser
 *  - Writes structured polling log (with masked credentials)
 *
 * Isolated from existing services (Mikrotik/Email/SMS/Payment).
 */
class OltConnector
{
    public function __construct(private CredentialVault $vault) {}

    public function adapter(string $vendor): OltAdapterInterface
    {
        return match (strtolower($vendor)) {
            'zte' => new ZteOltAdapter(),
            'vsol', 'v-sol' => new VsolOltAdapter(),
            'bdcom' => new BdcomOltAdapter(),
            default => new HuaweiOltAdapter(),
        };
    }

    public function testConnection(OltDevice $device): array
    {
        $pwd = $this->vault->decrypt($device->password_encrypted, $device->tenant_id) ?? '';
        $start = microtime(true);
        $res = $this->adapter($device->vendor)->testConnection($device, $pwd);
        $this->log($device, 'probe', $res, $start, 0);
        return $res;
    }

    public function pollOnus(OltDevice $device): array
    {
        $pwd = $this->vault->decrypt($device->password_encrypted, $device->tenant_id) ?? '';
        $start = microtime(true);
        $adapter = $this->adapter($device->vendor);
        $res = $adapter->fetchOnus($device, $pwd);
        $this->log($device, 'fetch_onus', $res, $start, count($res['onus'] ?? []));
        return $res;
    }

    private function log(OltDevice $device, string $command, array $res, float $start, int $onuCount): void
    {
        try {
            OltPollingLog::create([
                'tenant_id' => $device->tenant_id,
                'olt_device_id' => $device->id,
                'connection_mode' => $res['mode'] ?? null,
                'command' => $command,
                'status' => ($res['ok'] ?? false) ? 'ok' : 'error',
                'duration_ms' => (int) ((microtime(true) - $start) * 1000),
                'onu_count' => $onuCount,
                'response' => isset($res['raw']) ? mb_substr((string)$res['raw'], 0, 4000) : null,
                'error_message' => $res['error'] ?? ($res['ok'] ?? false ? null : ($res['message'] ?? null)),
            ]);
        } catch (\Throwable $e) {
            // never let logging break the poll
        }
    }
}

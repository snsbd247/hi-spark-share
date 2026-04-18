<?php

namespace App\Services\Fiber\Adapters;

use App\Models\OltDevice;
use App\Services\Fiber\Transports\SshTransport;

/**
 * Base class — provides shared SSH plumbing & safe defaults.
 * Vendor subclasses override parsing/commands.
 */
abstract class AbstractOltAdapter implements OltAdapterInterface
{
    protected SshTransport $ssh;

    public function __construct(?SshTransport $ssh = null)
    {
        $this->ssh = $ssh ?? new SshTransport();
    }

    public function testConnection(OltDevice $device, string $plainPassword): array
    {
        try {
            $result = $this->ssh->exec(
                $device->ip_address,
                $device->port ?: 22,
                (string) $device->username,
                $plainPassword,
                $this->probeCommand(),
                10
            );
            return [
                'ok' => $result['ok'],
                'mode' => 'cli',
                'message' => $result['ok'] ? 'Connected via SSH' : ($result['error'] ?? 'Connection failed'),
                'raw' => mb_substr((string)($result['output'] ?? ''), 0, 500),
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'mode' => 'cli', 'message' => $e->getMessage()];
        }
    }

    public function fetchOnus(OltDevice $device, string $plainPassword): array
    {
        try {
            $result = $this->ssh->exec(
                $device->ip_address,
                $device->port ?: 22,
                (string) $device->username,
                $plainPassword,
                $this->onuListCommand(),
                20
            );
            if (!$result['ok']) {
                return ['ok' => false, 'mode' => 'cli', 'onus' => [], 'error' => $result['error'] ?? 'fetch failed'];
            }
            $onus = $this->parseOnuList((string) $result['output']);
            return ['ok' => true, 'mode' => 'cli', 'onus' => $onus, 'raw' => mb_substr((string)$result['output'], 0, 2000)];
        } catch (\Throwable $e) {
            return ['ok' => false, 'mode' => 'cli', 'onus' => [], 'error' => $e->getMessage()];
        }
    }

    abstract protected function probeCommand(): string;
    abstract protected function onuListCommand(): string;

    /**
     * @return array<int, array{serial_number:string,status:string,rx_power:?float,tx_power:?float,olt_rx_power:?float,uptime:?string,distance_m:?int}>
     */
    abstract protected function parseOnuList(string $raw): array;
}

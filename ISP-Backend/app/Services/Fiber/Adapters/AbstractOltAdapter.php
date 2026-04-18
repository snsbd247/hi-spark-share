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

            // Phase 6: optionally enrich with optical-info (rx/tx/olt_rx) via second command.
            $opticalCmd = $this->opticalInfoCommand();
            if ($opticalCmd) {
                try {
                    $opt = $this->ssh->exec(
                        $device->ip_address,
                        $device->port ?: 22,
                        (string) $device->username,
                        $plainPassword,
                        $opticalCmd,
                        25
                    );
                    if (($opt['ok'] ?? false) === true) {
                        $optical = $this->parseOpticalInfo((string) $opt['output']);
                        $onus = $this->mergeOptical($onus, $optical);
                    }
                } catch (\Throwable $e) { /* enrichment is best-effort */ }
            }

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

    /** Optional vendor-specific optical-info command. Return null to skip enrichment. */
    protected function opticalInfoCommand(): ?string { return null; }

    /** Parse optical-info → ['SN' => ['rx'=>..,'tx'=>..,'olt_rx'=>..,'distance_m'=>..]] */
    protected function parseOpticalInfo(string $raw): array { return []; }

    /** Merge optical map into onu list — only fills null fields, never overwrites known values. */
    protected function mergeOptical(array $onus, array $optical): array
    {
        if (empty($optical)) return $onus;
        foreach ($onus as &$row) {
            $key = $row['serial_number'] ?? null;
            if (!$key || !isset($optical[$key])) continue;
            $o = $optical[$key];
            if (($row['rx_power'] ?? null) === null && isset($o['rx'])) $row['rx_power'] = (float) $o['rx'];
            if (($row['tx_power'] ?? null) === null && isset($o['tx'])) $row['tx_power'] = (float) $o['tx'];
            if (($row['olt_rx_power'] ?? null) === null && isset($o['olt_rx'])) $row['olt_rx_power'] = (float) $o['olt_rx'];
            if (($row['distance_m'] ?? null) === null && isset($o['distance_m'])) $row['distance_m'] = (int) $o['distance_m'];
        }
        return $onus;
    }
}

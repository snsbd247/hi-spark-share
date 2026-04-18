<?php

namespace App\Services\Fiber\Adapters;

class BdcomOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'bdcom'; }

    protected function probeCommand(): string
    {
        return "enable\r\nshow version\r\nexit\r\n";
    }

    protected function onuListCommand(): string
    {
        return "enable\r\nshow epon onu summary\r\nexit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            if (preg_match('/([0-9a-f]{2}([:\-])[0-9a-f]{2}(\2[0-9a-f]{2}){4})/i', $line, $m)) {
                $mac = strtoupper($m[1]);
                $onus[] = [
                    'serial_number' => $mac,
                    'status' => stripos($line, 'online') !== false ? 'online' : 'offline',
                    'rx_power' => null,
                    'tx_power' => null,
                    'olt_rx_power' => null,
                    'uptime' => null,
                    'distance_m' => null,
                ];
            }
        }
        return $onus;
    }
}

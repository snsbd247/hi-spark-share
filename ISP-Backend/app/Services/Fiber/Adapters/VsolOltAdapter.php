<?php

namespace App\Services\Fiber\Adapters;

class VsolOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'vsol'; }

    protected function probeCommand(): string
    {
        return "enable\r\nshow version\r\nexit\r\n";
    }

    protected function onuListCommand(): string
    {
        return "enable\r\nshow onu all\r\nexit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            if (preg_match('/\b([0-9A-F]{12,16}|VSOL[0-9A-F]+)\b/i', $line, $m)) {
                $rx = null;
                if (preg_match('/(-?\d+\.\d+)/', $line, $r)) $rx = (float) $r[1];
                $onus[] = [
                    'serial_number' => strtoupper($m[1]),
                    'status' => stripos($line, 'online') !== false ? 'online' : 'offline',
                    'rx_power' => $rx,
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

<?php

namespace App\Services\Fiber\Adapters;

class ZteOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'zte'; }

    protected function probeCommand(): string
    {
        return "enable\r\nshow version\r\nexit\r\n";
    }

    protected function onuListCommand(): string
    {
        // ZTE C300/C320 — list all ONUs
        return "enable\r\nshow gpon onu state\r\nexit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            if (preg_match('/gpon-onu_(\d+\/\d+\/\d+:\d+)\s+(\S+)\s+(\S+)/i', $line, $m)) {
                $onus[] = [
                    'serial_number' => strtoupper($m[2]),
                    'status' => stripos($m[3], 'working') !== false ? 'online' : 'offline',
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

<?php

namespace App\Services\Fiber\Adapters;

class HuaweiOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'huawei'; }

    protected function probeCommand(): string
    {
        // enable + display version (Huawei MA56xx/MA58xx)
        return "enable\r\ndisplay version\r\nquit\r\n";
    }

    protected function onuListCommand(): string
    {
        return "enable\r\nconfig\r\ndisplay ont info summary\r\nquit\r\nquit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            // Heuristic — Huawei summary rows usually contain SN like "HWTC..." or hex
            if (preg_match('/\b([0-9A-F]{8}|HWTC[0-9A-F]+)\b/i', $line, $m)) {
                $sn = strtoupper($m[1]);
                $status = stripos($line, 'online') !== false ? 'online'
                    : (stripos($line, 'offline') !== false ? 'offline' : 'unknown');
                $rx = null;
                if (preg_match('/(-?\d+\.\d+)\s*dBm/i', $line, $r)) {
                    $rx = (float) $r[1];
                }
                $onus[] = [
                    'serial_number' => $sn,
                    'status' => $status,
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

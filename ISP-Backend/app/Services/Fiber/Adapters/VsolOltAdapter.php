<?php

namespace App\Services\Fiber\Adapters;

/**
 * VSOL / V-SOL EPON / GPON OLT adapter.
 *
 * Typical CLI flow:
 *   enable
 *   show onu info all
 *
 * Sample row:
 *   1/1:1  VSOL12345678  online   -23.10  2.30  300
 *   Port    SN            Status   Rx     Tx    Distance
 */
class VsolOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'vsol'; }

    protected function probeCommand(): string
    {
        return "enable\r\nshow version\r\nexit\r\n";
    }

    protected function onuListCommand(): string
    {
        return "enable\r\nterminal length 0\r\nshow onu info all\r\nexit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || stripos($line, 'Port') === 0) continue;

            // Try SN: 12-16 hex/alnum chars OR VSOL prefix
            if (!preg_match('/\b((?:VSOL[0-9A-F]+)|(?:[0-9A-F]{12,16}))\b/i', $line, $snM)) continue;
            $sn = strtoupper($snM[1]);

            $status = 'unknown';
            if (stripos($line, 'online') !== false) $status = 'online';
            elseif (stripos($line, 'offline') !== false) $status = 'offline';
            elseif (stripos($line, 'los') !== false) $status = 'los';

            // Extract floats — first = Rx, second = Tx
            $rx = null; $tx = null; $distance = null;
            if (preg_match_all('/(-?\d+\.\d+)/', $line, $fM)) {
                if (isset($fM[1][0])) $rx = (float) $fM[1][0];
                if (isset($fM[1][1])) $tx = (float) $fM[1][1];
            }
            if (preg_match('/\b(\d{2,5})\b\s*m?\s*$/', $line, $dM)) {
                $d = (int) $dM[1];
                if ($d >= 10 && $d <= 60000) $distance = $d;
            }

            $onus[$sn] = [
                'serial_number' => $sn,
                'status'        => $status,
                'rx_power'      => $rx,
                'tx_power'      => $tx,
                'olt_rx_power'  => null,
                'uptime'        => null,
                'distance_m'    => $distance,
            ];
        }
        return array_values($onus);
    }

    /** Phase 6: enrich with `show gpon onu detail-info` for accurate optical readings. */
    protected function opticalInfoCommand(): ?string
    {
        return "enable\r\nterminal length 0\r\nshow gpon onu detail-info\r\nexit\r\n";
    }

    protected function parseOpticalInfo(string $raw): array
    {
        $blocks = preg_split('/\n\s*\n/', $raw) ?: [];
        $out = [];
        foreach ($blocks as $block) {
            if (!preg_match('/\b((?:VSOL[0-9A-F]+)|(?:[0-9A-F]{12,16}))\b/i', $block, $sM)) continue;
            $sn = strtoupper($sM[1]);
            $entry = [];
            if (preg_match('/rx\s*power[^:]*:\s*(-?\d+\.\d+)/i', $block, $m)) $entry['rx'] = (float) $m[1];
            if (preg_match('/tx\s*power[^:]*:\s*(-?\d+\.\d+)/i', $block, $m)) $entry['tx'] = (float) $m[1];
            if (preg_match('/olt\s*rx[^:]*:\s*(-?\d+\.\d+)/i', $block, $m)) $entry['olt_rx'] = (float) $m[1];
            if (preg_match('/distance[^:]*:\s*(\d{1,5})/i', $block, $m)) $entry['distance_m'] = (int) $m[1];
            if ($entry) $out[$sn] = $entry;
        }
        return $out;
    }
}

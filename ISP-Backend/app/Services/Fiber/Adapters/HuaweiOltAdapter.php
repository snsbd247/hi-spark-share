<?php

namespace App\Services\Fiber\Adapters;

/**
 * Huawei MA56xx / MA58xx GPON OLT adapter.
 *
 * Typical CLI flow:
 *   enable
 *   config
 *   display ont info summary 0/1     ← per PON board
 *   display ont optical-info <fid> <sid> <oid>
 *
 * For Phase 3 we use the broad summary command and parse multiple row formats:
 *   F/S/P  ONT-ID  SN              Run-state  Last up time         Last down cause
 *   0/1/0  1       HWTC12345678   online      2025-01-01 10:00:00  -
 *
 * Optical info lines (when present):
 *   Rx optical power(dBm)   : -22.45
 *   Tx optical power(dBm)   : 2.10
 *   OLT Rx ONT optical power(dBm): -23.10
 */
class HuaweiOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'huawei'; }

    protected function probeCommand(): string
    {
        return "enable\r\ndisplay version\r\nquit\r\n";
    }

    protected function onuListCommand(): string
    {
        // `undo terminal monitor` + `scroll 512` minimises pagination prompts
        return "enable\r\nundo smart\r\nundo interactive\r\nscroll 512\r\ndisplay ont info summary 0\r\nquit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '-') || stripos($line, 'F/S/P') !== false) {
                continue;
            }

            // Match SN: 4-letter vendor prefix + 8 hex (HWTC...) OR pure 16 hex chars
            if (!preg_match('/\b((?:[A-Z]{4}[0-9A-F]{8})|(?:[0-9A-F]{16}))\b/i', $line, $snM)) {
                continue;
            }
            $sn = strtoupper($snM[1]);

            $status = 'unknown';
            if (stripos($line, 'online') !== false || stripos($line, 'working') !== false) $status = 'online';
            elseif (stripos($line, 'offline') !== false) $status = 'offline';
            elseif (stripos($line, 'los') !== false) $status = 'los';
            elseif (stripos($line, 'dying-gasp') !== false || stripos($line, 'dying gasp') !== false) $status = 'dying-gasp';

            // Distance (m) — Huawei prints "Distance(m): 1234"
            $distance = null;
            if (preg_match('/distance.*?:\s*(\d{1,5})/i', $line, $dM)) {
                $distance = (int) $dM[1];
            }

            // Powers (rare on summary, common on optical-info lines that may be appended)
            $rx = null; $tx = null; $oltRx = null;
            if (preg_match('/rx[^:]*:\s*(-?\d+\.\d+)/i', $line, $m)) $rx = (float) $m[1];
            if (preg_match('/tx[^:]*:\s*(-?\d+\.\d+)/i', $line, $m)) $tx = (float) $m[1];
            if (preg_match('/olt\s*rx[^:]*:\s*(-?\d+\.\d+)/i', $line, $m)) $oltRx = (float) $m[1];

            // Uptime "Last up time" yyyy-mm-dd hh:mm:ss
            $uptime = null;
            if (preg_match('/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/', $line, $uM)) {
                $uptime = $uM[1];
            }

            $onus[$sn] = [
                'serial_number' => $sn,
                'status'        => $status,
                'rx_power'      => $rx,
                'tx_power'      => $tx,
                'olt_rx_power'  => $oltRx,
                'uptime'        => $uptime,
                'distance_m'    => $distance,
            ];
        }
        return array_values($onus);
    }

    /**
     * Phase 6: enrich with `display ont optical-info` across all PON ports on board 0.
     * On Huawei MA56xx/MA58xx, "display ont optical-info 0 all" returns rx/tx/olt-rx for every active ONT.
     */
    protected function opticalInfoCommand(): ?string
    {
        return "enable\r\nundo smart\r\nundo interactive\r\nscroll 512\r\ndisplay ont optical-info 0 all\r\nquit\r\n";
    }

    protected function parseOpticalInfo(string $raw): array
    {
        // Output is grouped per ONT with an SN header line, followed by Rx/Tx/OLT-Rx labeled lines.
        $blocks = preg_split('/\n\s*\n/', $raw) ?: [];
        $out = [];
        foreach ($blocks as $block) {
            if (!preg_match('/\b((?:[A-Z]{4}[0-9A-F]{8})|(?:[0-9A-F]{16}))\b/i', $block, $sM)) continue;
            $sn = strtoupper($sM[1]);
            $entry = [];
            if (preg_match('/rx\s*optical\s*power[^:]*:\s*(-?\d+\.\d+)/i', $block, $m)) $entry['rx'] = (float) $m[1];
            if (preg_match('/tx\s*optical\s*power[^:]*:\s*(-?\d+\.\d+)/i', $block, $m)) $entry['tx'] = (float) $m[1];
            if (preg_match('/olt\s*rx[^:]*:\s*(-?\d+\.\d+)/i', $block, $m)) $entry['olt_rx'] = (float) $m[1];
            if (preg_match('/distance[^:]*:\s*(\d{1,5})/i', $block, $m)) $entry['distance_m'] = (int) $m[1];
            if ($entry) $out[$sn] = $entry;
        }
        return $out;
    }
}

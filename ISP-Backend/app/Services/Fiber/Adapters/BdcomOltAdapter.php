<?php

namespace App\Services\Fiber\Adapters;

/**
 * BDCOM EPON OLT adapter (P3310 / P3608 series).
 *
 * Typical CLI flow:
 *   enable
 *   show epon interface EPON0/1 onu summary
 *
 * Sample row:
 *   EPON0/1:1   00:11:22:33:44:55   online    1234   -23.10
 *   Interface    MAC                State     Distance Rx-power
 */
class BdcomOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'bdcom'; }

    protected function probeCommand(): string
    {
        return "enable\r\nshow version\r\nexit\r\n";
    }

    protected function onuListCommand(): string
    {
        return "enable\r\nterminal length 0\r\nshow epon onu-summary\r\nexit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || stripos($line, 'Interface') === 0) continue;

            // MAC address acts as SN identifier on EPON
            if (!preg_match('/([0-9a-f]{2}([:\-])[0-9a-f]{2}(?:\2[0-9a-f]{2}){4})/i', $line, $m)) continue;
            $mac = strtoupper(str_replace('-', ':', $m[1]));

            $status = 'unknown';
            if (stripos($line, 'online') !== false || stripos($line, 'auto') !== false) $status = 'online';
            elseif (stripos($line, 'offline') !== false) $status = 'offline';
            elseif (stripos($line, 'los') !== false) $status = 'los';

            $distance = null;
            if (preg_match('/\b(\d{2,5})\b\s+-?\d+\.\d+/', $line, $dM)) {
                $d = (int) $dM[1];
                if ($d >= 10 && $d <= 60000) $distance = $d;
            }

            $rx = null;
            if (preg_match('/(-?\d+\.\d+)/', $line, $rM)) $rx = (float) $rM[1];

            $onus[$mac] = [
                'serial_number' => $mac,
                'status'        => $status,
                'rx_power'      => $rx,
                'tx_power'      => null,
                'olt_rx_power'  => null,
                'uptime'        => null,
                'distance_m'    => $distance,
            ];
        }
        return array_values($onus);
    }

    /** Phase 6: enrich with `show epon onu optical` for accurate Rx/Tx. */
    protected function opticalInfoCommand(): ?string
    {
        return "enable\r\nterminal length 0\r\nshow epon onu optical\r\nexit\r\n";
    }

    protected function parseOpticalInfo(string $raw): array
    {
        // Sample line:  EPON0/1:1  00:11:22:33:44:55  -23.10  2.30  1234
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $out = [];
        foreach ($lines as $line) {
            if (!preg_match('/([0-9a-f]{2}([:\-])[0-9a-f]{2}(?:\2[0-9a-f]{2}){4})/i', $line, $mm)) continue;
            $mac = strtoupper(str_replace('-', ':', $mm[1]));
            $entry = [];
            if (preg_match_all('/(-?\d+\.\d+)/', $line, $fM)) {
                if (isset($fM[1][0])) $entry['rx'] = (float) $fM[1][0];
                if (isset($fM[1][1])) $entry['tx'] = (float) $fM[1][1];
            }
            if (preg_match('/\b(\d{2,5})\s*$/', $line, $dM)) {
                $d = (int) $dM[1];
                if ($d >= 10 && $d <= 60000) $entry['distance_m'] = $d;
            }
            if ($entry) $out[$mac] = $entry;
        }
        return $out;
    }
}

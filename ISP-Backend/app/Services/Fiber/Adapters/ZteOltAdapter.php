<?php

namespace App\Services\Fiber\Adapters;

/**
 * ZTE C300 / C320 / C600 GPON OLT adapter.
 *
 * Typical CLI flow:
 *   enable
 *   show gpon onu state
 *   show pon power onu-rx gpon-onu_1/2/3:1
 *
 * Output rows look like:
 *   gpon-onu_1/2/3:1   ZTEGC1234567   ready   working   -25.31
 *   OnuIndex            SN             Adm     OperState Phase-state
 */
class ZteOltAdapter extends AbstractOltAdapter
{
    public function vendor(): string { return 'zte'; }

    protected function probeCommand(): string
    {
        return "enable\r\nshow version\r\nexit\r\n";
    }

    protected function onuListCommand(): string
    {
        return "enable\r\nterminal length 0\r\nshow gpon onu state\r\nexit\r\n";
    }

    protected function parseOnuList(string $raw): array
    {
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $onus = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || stripos($line, 'OnuIndex') !== false) continue;

            // gpon-onu_<frame/slot/port>:<onu-id>  <SN>  <admin>  <oper>  ...
            if (!preg_match('/gpon-onu_(\d+\/\d+\/\d+):(\d+)\s+(\S+)\s+(\S+)\s+(\S+)/i', $line, $m)) continue;

            $sn = strtoupper($m[3]);
            $oper = strtolower($m[5]);

            $status = match (true) {
                str_contains($oper, 'working') => 'online',
                str_contains($oper, 'logout'), str_contains($oper, 'offline') => 'offline',
                str_contains($oper, 'los') => 'los',
                str_contains($oper, 'dying') => 'dying-gasp',
                default => 'unknown',
            };

            // Optional appended Rx power column on some firmwares
            $rx = null;
            if (preg_match('/(-?\d+\.\d+)\s*$/', $line, $rM)) $rx = (float) $rM[1];

            $onus[$sn] = [
                'serial_number' => $sn,
                'status'        => $status,
                'rx_power'      => $rx,
                'tx_power'      => null,
                'olt_rx_power'  => null,
                'uptime'        => null,
                'distance_m'    => null,
            ];
        }
        return array_values($onus);
    }

    /** Phase 6: enrich with `show pon power onu-rx` (returns OLT-side rx for each ONU). */
    protected function opticalInfoCommand(): ?string
    {
        // Aggregate: works on most C300/C320/C600 firmwares.
        return "enable\r\nterminal length 0\r\nshow pon power onu-rx\r\nshow pon power onu-tx\r\nexit\r\n";
    }

    protected function parseOpticalInfo(string $raw): array
    {
        // Lines like:  gpon-onu_1/2/3:1   ZTEGC1234567   -25.31
        $lines = preg_split("/\r?\n/", $raw) ?: [];
        $out = [];
        foreach ($lines as $line) {
            if (!preg_match('/gpon-onu_\d+\/\d+\/\d+:\d+\s+(\S+)\s+(-?\d+\.\d+)/i', $line, $m)) continue;
            $sn = strtoupper($m[1]);
            $val = (float) $m[2];
            if (!isset($out[$sn])) $out[$sn] = [];
            // Heuristic: first occurrence = OLT rx (downstream from ONU), second = ONU tx
            if (!isset($out[$sn]['olt_rx'])) $out[$sn]['olt_rx'] = $val;
            else $out[$sn]['tx'] = $val;
        }
        return $out;
    }
}

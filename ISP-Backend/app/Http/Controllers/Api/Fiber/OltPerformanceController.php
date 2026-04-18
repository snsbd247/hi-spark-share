<?php

namespace App\Http\Controllers\Api\Fiber;

use App\Http\Controllers\Controller;
use App\Models\OltDevice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Phase 14 — OLT Performance Dashboard
 *
 * Aggregates per-OLT and per-PON-port operational metrics from
 * onu_live_status, onu_signal_history, and onu_alert_logs.
 * No schema changes — pure read-only analytics.
 */
class OltPerformanceController extends Controller
{
    /**
     * Overview: one summary card per OLT device.
     * GET /api/fiber/olt-performance
     */
    public function overview()
    {
        $devices = OltDevice::orderBy('name')->get();

        $cards = $devices->map(function ($d) {
            $rows = DB::table('onu_live_status')
                ->where('olt_device_id', $d->id)
                ->get(['status', 'rx_power']);

            $total = $rows->count();
            $online = $rows->where('status', 'online')->count();
            $offline = $rows->where('status', 'offline')->count();
            $los = $rows->whereIn('status', ['los', 'dying-gasp'])->count();

            $avgRx = $rows->whereNotNull('rx_power')->avg('rx_power');
            $weakSignal = $rows->filter(fn ($r) => $r->rx_power !== null && $r->rx_power < -27)->count();

            $alerts24h = DB::table('onu_alert_logs')
                ->where('olt_device_id', $d->id)
                ->where('sent_at', '>=', now()->subHours(24))
                ->count();

            // Health score: 0–100 (online% * 0.7 + signal-quality% * 0.3)
            $onlinePct = $total > 0 ? ($online / $total) * 100 : 0;
            $signalQualityPct = $total > 0 ? (($total - $weakSignal) / $total) * 100 : 0;
            $health = $total > 0 ? round($onlinePct * 0.7 + $signalQualityPct * 0.3, 1) : null;

            return [
                'id' => $d->id,
                'name' => $d->name,
                'vendor' => $d->vendor,
                'ip_address' => $d->ip_address,
                'status' => $d->status,
                'is_active' => (bool) $d->is_active,
                'last_polled_at' => $d->last_polled_at,
                'total_onus' => $total,
                'online_onus' => $online,
                'offline_onus' => $offline,
                'los_onus' => $los,
                'weak_signal_count' => $weakSignal,
                'avg_rx_power' => $avgRx !== null ? round((float) $avgRx, 2) : null,
                'alerts_24h' => $alerts24h,
                'health_score' => $health,
                'online_pct' => round($onlinePct, 1),
            ];
        });

        return response()->json([
            'devices' => $cards->values(),
            'totals' => [
                'devices' => $devices->count(),
                'total_onus' => $cards->sum('total_onus'),
                'online_onus' => $cards->sum('online_onus'),
                'alerts_24h' => $cards->sum('alerts_24h'),
            ],
        ]);
    }

    /**
     * Detail: per-PON-port breakdown + 24h timeline + signal distribution
     * GET /api/fiber/olt-performance/{id}
     */
    public function detail(string $id)
    {
        $device = OltDevice::findOrFail($id);

        // All ONUs for this OLT
        $onus = DB::table('onu_live_status')
            ->where('olt_device_id', $device->id)
            ->get(['serial_number', 'status', 'rx_power', 'tx_power', 'olt_rx_power', 'last_seen']);

        // Per-PON aggregation. Serial numbers do NOT carry port info, so we
        // fall back to fiber_onus → splitter_outputs → splitters → cables → pon_ports
        // mapping when available; otherwise, we group everything under "Unmapped".
        $serialToPort = $this->buildSerialToPortMap($device);

        $byPort = [];
        foreach ($onus as $o) {
            $port = $serialToPort[$o->serial_number] ?? 'Unmapped';
            $byPort[$port] ??= [
                'port' => $port,
                'total' => 0, 'online' => 0, 'offline' => 0, 'los' => 0,
                'rx_values' => [], 'weak' => 0,
            ];
            $byPort[$port]['total']++;
            if ($o->status === 'online') $byPort[$port]['online']++;
            elseif (in_array($o->status, ['los', 'dying-gasp'])) $byPort[$port]['los']++;
            else $byPort[$port]['offline']++;
            if ($o->rx_power !== null) {
                $byPort[$port]['rx_values'][] = (float) $o->rx_power;
                if ($o->rx_power < -27) $byPort[$port]['weak']++;
            }
        }

        $ports = collect($byPort)->map(function ($p) {
            $rx = $p['rx_values'];
            $count = count($rx);
            return [
                'port' => $p['port'],
                'total' => $p['total'],
                'online' => $p['online'],
                'offline' => $p['offline'],
                'los' => $p['los'],
                'weak_signal' => $p['weak'],
                'avg_rx' => $count > 0 ? round(array_sum($rx) / $count, 2) : null,
                'min_rx' => $count > 0 ? round(min($rx), 2) : null,
                'max_rx' => $count > 0 ? round(max($rx), 2) : null,
                'utilization_pct' => $p['total'] > 0 ? round(($p['total'] / 128) * 100, 1) : 0, // 1:128 max split
            ];
        })->sortBy('port')->values();

        // Signal distribution buckets across all ONUs
        $buckets = [
            'excellent' => 0, // > -20 dBm
            'good'      => 0, // -20 to -25
            'fair'      => 0, // -25 to -27
            'poor'      => 0, // < -27
            'no_data'   => 0,
        ];
        foreach ($onus as $o) {
            if ($o->rx_power === null) { $buckets['no_data']++; continue; }
            $rx = (float) $o->rx_power;
            if ($rx > -20) $buckets['excellent']++;
            elseif ($rx > -25) $buckets['good']++;
            elseif ($rx > -27) $buckets['fair']++;
            else $buckets['poor']++;
        }

        // 24h timeline — online count per hour from signal history
        $timeline = DB::table('onu_signal_history')
            ->where('olt_device_id', $device->id)
            ->where('recorded_at', '>=', now()->subHours(24))
            ->select(
                DB::raw("DATE_FORMAT(recorded_at, '%Y-%m-%d %H:00:00') as hour"),
                DB::raw("SUM(CASE WHEN status='online' THEN 1 ELSE 0 END) as online_count"),
                DB::raw("SUM(CASE WHEN status IN ('los','dying-gasp') THEN 1 ELSE 0 END) as los_count"),
                DB::raw("SUM(CASE WHEN status='offline' THEN 1 ELSE 0 END) as offline_count"),
                DB::raw("AVG(rx_power) as avg_rx")
            )
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->map(fn ($r) => [
                'hour' => $r->hour,
                'online' => (int) $r->online_count,
                'los' => (int) $r->los_count,
                'offline' => (int) $r->offline_count,
                'avg_rx' => $r->avg_rx !== null ? round((float) $r->avg_rx, 2) : null,
            ]);

        // Recent alerts (last 10)
        $recentAlerts = DB::table('onu_alert_logs')
            ->where('olt_device_id', $device->id)
            ->orderBy('sent_at', 'desc')
            ->limit(10)
            ->get(['id', 'serial', 'event_type', 'previous_status', 'current_status', 'sent_at']);

        return response()->json([
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'vendor' => $device->vendor,
                'ip_address' => $device->ip_address,
                'status' => $device->status,
                'last_polled_at' => $device->last_polled_at,
            ],
            'ports' => $ports,
            'signal_distribution' => $buckets,
            'timeline_24h' => $timeline,
            'recent_alerts' => $recentAlerts,
        ]);
    }

    /**
     * Build serial_number → port label map by walking
     * fiber_onus.splitter_output_id → splitter → cable → pon_port.
     * Falls back gracefully on missing tables.
     */
    private function buildSerialToPortMap(OltDevice $device): array
    {
        $map = [];
        try {
            $rows = DB::table('fiber_onus as o')
                ->leftJoin('fiber_splitter_outputs as so', 'so.id', '=', 'o.splitter_output_id')
                ->leftJoin('fiber_splitters as s', 's.id', '=', 'so.splitter_id')
                ->leftJoin('fiber_cables as c', 'c.id', '=', 's.cable_id')
                ->leftJoin('fiber_pon_ports as p', 'p.id', '=', 'c.pon_port_id')
                ->when($device->tenant_id, fn ($q) => $q->where('o.tenant_id', $device->tenant_id))
                ->select('o.serial_number', 'p.port_number')
                ->get();
            foreach ($rows as $r) {
                if ($r->serial_number) {
                    $map[$r->serial_number] = $r->port_number !== null ? "PON {$r->port_number}" : 'Unmapped';
                }
            }
        } catch (\Throwable $e) {
            // Topology tables may not all exist — return empty map
        }
        return $map;
    }
}

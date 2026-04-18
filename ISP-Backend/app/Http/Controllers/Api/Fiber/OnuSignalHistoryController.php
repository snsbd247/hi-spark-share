<?php

namespace App\Http\Controllers\Api\Fiber;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Phase 9 — Historical signal trend API.
 * Read-only; isolated from live status writes.
 */
class OnuSignalHistoryController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'serial' => 'required|string|max:255',
            'range' => 'nullable|in:24h,7d,30d',
        ]);

        $serial = $request->query('serial');
        $range = $request->query('range', '24h');
        $hours = match ($range) {
            '7d' => 24 * 7,
            '30d' => 24 * 30,
            default => 24,
        };
        $since = now()->subHours($hours);

        $rows = DB::table('onu_signal_history')
            ->where('serial_number', $serial)
            ->where('recorded_at', '>=', $since)
            ->orderBy('recorded_at')
            ->limit(5000)
            ->get(['rx_power', 'tx_power', 'olt_rx_power', 'status', 'recorded_at']);

        // Degradation detection — compare first vs last quarter average rx_power
        $degradation = null;
        $valid = $rows->filter(fn($r) => $r->rx_power !== null)->values();
        $n = $valid->count();
        if ($n >= 8) {
            $q = max(2, (int) floor($n / 4));
            $first = $valid->take($q)->avg('rx_power');
            $last = $valid->slice($n - $q)->avg('rx_power');
            if ($first !== null && $last !== null) {
                $delta = round($last - $first, 2); // negative = worse
                $degradation = [
                    'first_avg' => round($first, 2),
                    'last_avg' => round($last, 2),
                    'delta_db' => $delta,
                    'degraded' => $delta <= -3.0,
                ];
            }
        }

        return response()->json([
            'serial' => $serial,
            'range' => $range,
            'count' => $rows->count(),
            'points' => $rows,
            'degradation' => $degradation,
        ]);
    }
}

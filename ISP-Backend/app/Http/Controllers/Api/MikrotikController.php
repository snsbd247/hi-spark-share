<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MikrotikService;
use Illuminate\Http\Request;

class MikrotikController extends Controller
{
    public function __construct(protected MikrotikService $mikrotikService) {}

    public function sync(Request $request)
    {
        $request->validate(['customer_id' => 'required|uuid']);
        $result = $this->mikrotikService->syncCustomer($request->customer_id);
        return response()->json($result);
    }

    public function syncAll()
    {
        $result = $this->mikrotikService->syncAllCustomers();
        return response()->json($result);
    }

    /**
     * Test connection to a MikroTik router.
     * Accepts either router_id (existing router) or host/username/password/port (ad-hoc test).
     */
    public function testConnection(Request $request)
    {
        // Support both formats: existing router ID or ad-hoc credentials
        if ($request->has('router_id')) {
            $request->validate(['router_id' => 'required|uuid']);
            $result = $this->mikrotikService->testConnection($request->router_id);
            return response()->json($result);
        }

        // Ad-hoc test with raw credentials
        $request->validate([
            'host' => 'required_without:ip_address|string',
            'ip_address' => 'required_without:host|string',
            'username' => 'required|string|max:100',
            'password' => 'required|string|max:100',
            'port' => 'nullable|integer|min:1|max:65535',
            'api_port' => 'nullable|integer|min:1|max:65535',
        ]);

        $host = $request->input('host', $request->input('ip_address'));
        $username = $request->input('username', 'admin');
        $password = $request->input('password', '');
        $port = $request->input('port', $request->input('api_port', 8728));

        try {
            $socket = @fsockopen($host, $port, $errno, $errstr, 5);
            if (!$socket) {
                return response()->json([
                    'success' => false,
                    'message' => "Connection failed: {$errstr} (Error #{$errno})",
                ]);
            }

            // Try MikroTik API login
            $this->writeWord($socket, '/login');
            $this->writeWord($socket, '=name=' . $username);
            $this->writeWord($socket, '=password=' . $password);
            $this->writeWord($socket, '');

            $response = $this->readResponse($socket);
            fclose($socket);

            $responseStr = implode('', $response);
            if (str_contains($responseStr, '!done')) {
                return response()->json([
                    'success' => true,
                    'message' => 'Connection successful! Router is reachable and credentials are valid.',
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Connection established but login failed. Check username/password.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Connection error: ' . $e->getMessage(),
            ]);
        }
    }

    // ── MikroTik API Protocol Helpers ────────────────────
    private function writeWord($socket, string $word): void
    {
        $len = strlen($word);
        if ($len < 0x80) {
            fwrite($socket, chr($len));
        } elseif ($len < 0x4000) {
            $len |= 0x8000;
            fwrite($socket, chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        }
        fwrite($socket, $word);
    }

    private function readResponse($socket): array
    {
        $responses = [];
        stream_set_timeout($socket, 5);

        while (true) {
            $byte = @fread($socket, 1);
            if ($byte === false || $byte === '') break;

            $len = ord($byte);
            if ($len === 0) {
                if (!empty($responses) && (str_contains(end($responses), '!done') || str_contains(end($responses), '!trap'))) {
                    break;
                }
                continue;
            }

            if ($len >= 0x80) {
                $byte2 = ord(fread($socket, 1));
                $len = (($len & 0x7F) << 8) | $byte2;
            }

            $word = '';
            while (strlen($word) < $len) {
                $chunk = fread($socket, $len - strlen($word));
                if ($chunk === false) break;
                $word .= $chunk;
            }
            $responses[] = $word;

            if (str_contains($word, '!done') || str_contains($word, '!trap')) {
                break;
            }
        }

        return $responses;
    }
}

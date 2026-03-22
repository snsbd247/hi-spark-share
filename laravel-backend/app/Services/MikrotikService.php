<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\MikrotikRouter;
use App\Models\Package;
use Illuminate\Support\Facades\Log;

class MikrotikService
{
    /**
     * Connect to MikroTik router via Classic API (TCP 8728).
     */
    protected function connect(MikrotikRouter $router): ?object
    {
        try {
            $socket = @fsockopen($router->ip_address, $router->api_port, $errno, $errstr, 5);
            if (!$socket) {
                Log::error("MikroTik connection failed: {$errstr}");
                return null;
            }

            // Login
            $this->writeWord($socket, '/login');
            $this->writeWord($socket, '=name=' . $router->username);
            $this->writeWord($socket, '=password=' . $router->password);
            $this->writeWord($socket, '');

            $response = $this->readResponse($socket);
            if (empty($response) || !str_contains(implode('', $response), '!done')) {
                fclose($socket);
                return null;
            }

            return (object)['socket' => $socket, 'router' => $router];
        } catch (\Exception $e) {
            Log::error('MikroTik connect error: ' . $e->getMessage());
            return null;
        }
    }

    protected function writeWord($socket, string $word): void
    {
        $len = strlen($word);
        if ($len < 0x80) {
            fwrite($socket, chr($len));
        } elseif ($len < 0x4000) {
            $len |= 0x8000;
            fwrite($socket, chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        } elseif ($len < 0x200000) {
            $len |= 0xC00000;
            fwrite($socket, chr(($len >> 16) & 0xFF) . chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        }
        fwrite($socket, $word);
    }

    protected function readResponse($socket): array
    {
        $response = [];
        stream_set_timeout($socket, 5);
        while (true) {
            $word = $this->readWord($socket);
            if ($word === false || $word === '') {
                if (!empty($response) && in_array(end($response), ['!done', '!trap'])) break;
                if (empty($word) && !empty($response)) break;
                continue;
            }
            $response[] = $word;
            if ($word === '!done' || $word === '!trap') break;
        }
        return $response;
    }

    protected function readWord($socket)
    {
        $byte = fread($socket, 1);
        if ($byte === false || $byte === '') return false;
        $len = ord($byte);

        if ($len >= 0x80) {
            if ($len < 0xC0) {
                $len = (($len & 0x3F) << 8) + ord(fread($socket, 1));
            } elseif ($len < 0xE0) {
                $len = (($len & 0x1F) << 16) + (ord(fread($socket, 1)) << 8) + ord(fread($socket, 1));
            }
        }

        if ($len === 0) return '';
        return fread($socket, $len);
    }

    protected function sendCommand($connection, array $command): array
    {
        foreach ($command as $word) {
            $this->writeWord($connection->socket, $word);
        }
        $this->writeWord($connection->socket, '');
        return $this->readResponse($connection->socket);
    }

    public function syncCustomer(string $customerId): array
    {
        $customer = Customer::with(['package', 'router'])->findOrFail($customerId);

        if (!$customer->router) {
            return ['success' => false, 'error' => 'No router assigned'];
        }

        if (!$customer->pppoe_username || !$customer->pppoe_password) {
            return ['success' => false, 'error' => 'Missing PPPoE credentials'];
        }

        $conn = $this->connect($customer->router);
        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $profileName = $customer->package->mikrotik_profile_name ?? $customer->package->name ?? 'default';

            // Ensure profile exists
            $this->ensureProfile($conn, $customer->package, $profileName);

            // Check if secret exists
            $existing = $this->sendCommand($conn, [
                '/ppp/secret/print',
                '?name=' . $customer->pppoe_username,
            ]);

            $existingId = null;
            foreach ($existing as $line) {
                if (str_starts_with($line, '=.id=')) {
                    $existingId = substr($line, 4);
                }
            }

            if ($existingId) {
                // Update
                $this->sendCommand($conn, [
                    '/ppp/secret/set',
                    '=.id=' . $existingId,
                    '=password=' . $customer->pppoe_password,
                    '=profile=' . $profileName,
                    '=service=pppoe',
                    '=disabled=' . ($customer->status !== 'active' ? 'yes' : 'no'),
                ]);
            } else {
                // Create
                $cmd = [
                    '/ppp/secret/add',
                    '=name=' . $customer->pppoe_username,
                    '=password=' . $customer->pppoe_password,
                    '=profile=' . $profileName,
                    '=service=pppoe',
                ];
                if ($customer->ip_address) {
                    $cmd[] = '=remote-address=' . $customer->ip_address;
                }
                $this->sendCommand($conn, $cmd);
            }

            fclose($conn->socket);

            $customer->update(['mikrotik_sync_status' => 'synced']);
            return ['success' => true, 'message' => 'Customer synced to MikroTik'];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            $customer->update(['mikrotik_sync_status' => 'error']);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    protected function ensureProfile($connection, ?Package $package, string $profileName): void
    {
        if (!$package) return;

        $check = $this->sendCommand($connection, [
            '/ppp/profile/print',
            '?name=' . $profileName,
        ]);

        $exists = false;
        foreach ($check as $line) {
            if (str_starts_with($line, '=.id=')) {
                $exists = true;
                break;
            }
        }

        if (!$exists) {
            $rateLimit = $package->upload_speed . 'M/' . $package->download_speed . 'M';
            $this->sendCommand($connection, [
                '/ppp/profile/add',
                '=name=' . $profileName,
                '=rate-limit=' . $rateLimit,
                '=local-address=10.10.10.1',
            ]);
        }
    }

    public function syncAllCustomers(): array
    {
        $customers = Customer::whereNotNull('router_id')
            ->whereNotNull('pppoe_username')
            ->where('status', '!=', 'disconnected')
            ->get();

        $results = ['synced' => 0, 'failed' => 0, 'total' => $customers->count()];

        foreach ($customers as $customer) {
            $result = $this->syncCustomer($customer->id);
            $result['success'] ? $results['synced']++ : $results['failed']++;
        }

        return $results;
    }

    public function testConnection(string $routerId): array
    {
        $router = MikrotikRouter::findOrFail($routerId);
        $conn = $this->connect($router);

        if (!$conn) {
            $router->update(['status' => 'offline']);
            return ['success' => false, 'error' => 'Connection failed'];
        }

        fclose($conn->socket);
        $router->update(['status' => 'active']);
        return ['success' => true, 'message' => 'Connection successful'];
    }

    /**
     * Disable a customer's PPPoE secret on the router.
     */
    public function disablePppoe(Customer $customer): array
    {
        return $this->setPppoeDisabled($customer, true);
    }

    /**
     * Enable a customer's PPPoE secret on the router.
     */
    public function enablePppoe(Customer $customer): array
    {
        return $this->setPppoeDisabled($customer, false);
    }

    protected function setPppoeDisabled(Customer $customer, bool $disabled): array
    {
        if (!$customer->router || !$customer->pppoe_username) {
            return ['success' => false, 'error' => 'Missing router or PPPoE credentials'];
        }

        $conn = $this->connect($customer->router);
        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            // Find the secret
            $existing = $this->sendCommand($conn, [
                '/ppp/secret/print',
                '?name=' . $customer->pppoe_username,
            ]);

            $existingId = null;
            foreach ($existing as $line) {
                if (str_starts_with($line, '=.id=')) {
                    $existingId = substr($line, 4);
                }
            }

            if (!$existingId) {
                fclose($conn->socket);
                return ['success' => false, 'error' => 'PPPoE secret not found on router'];
            }

            $this->sendCommand($conn, [
                '/ppp/secret/set',
                '=.id=' . $existingId,
                '=disabled=' . ($disabled ? 'yes' : 'no'),
            ]);

            // Disconnect active session if disabling
            if ($disabled) {
                $this->sendCommand($conn, [
                    '/ppp/active/remove',
                    '?name=' . $customer->pppoe_username,
                ]);
            }

            fclose($conn->socket);

            $customer->update([
                'connection_status' => $disabled ? 'disabled' : 'active',
            ]);

            return [
                'success' => true,
                'message' => 'PPPoE ' . ($disabled ? 'disabled' : 'enabled') . ' successfully',
            ];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Sync a package profile to its assigned router.
     */
    public function syncProfile(Package $package): array
    {
        if (!$package->router) {
            return ['success' => false, 'error' => 'No router assigned'];
        }

        $conn = $this->connect($package->router);
        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $profileName = $package->mikrotik_profile_name ?? $package->name ?? 'default';
            $this->ensureProfile($conn, $package, $profileName);
            fclose($conn->socket);
            return ['success' => true, 'message' => "Profile '{$profileName}' synced"];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Remove a package profile from its assigned router.
     */
    public function removeProfile(Package $package): array
    {
        if (!$package->router) {
            return ['success' => false, 'error' => 'No router assigned'];
        }

        $conn = $this->connect($package->router);
        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $profileName = $package->mikrotik_profile_name ?? $package->name;

            $check = $this->sendCommand($conn, [
                '/ppp/profile/print',
                '?name=' . $profileName,
            ]);

            $profileId = null;
            foreach ($check as $line) {
                if (str_starts_with($line, '=.id=')) {
                    $profileId = substr($line, 4);
                }
            }

            if ($profileId) {
                $this->sendCommand($conn, [
                    '/ppp/profile/remove',
                    '=.id=' . $profileId,
                ]);
            }

            fclose($conn->socket);
            return ['success' => true, 'message' => "Profile '{$profileName}' removed"];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get router resource stats (uptime, CPU, memory, version).
     */
    public function getRouterStats(string $routerId): array
    {
        $router = MikrotikRouter::findOrFail($routerId);
        $conn = $this->connect($router);

        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $resource = $this->sendCommand($conn, ['/system/resource/print']);

            $stats = [];
            foreach ($resource as $line) {
                if (str_contains($line, '=')) {
                    $parts = explode('=', $line, 3);
                    if (count($parts) >= 3) {
                        $stats[$parts[1]] = $parts[2];
                    }
                }
            }

            // Get active PPPoE connections count
            $active = $this->sendCommand($conn, ['/ppp/active/print']);
            $activeCount = 0;
            foreach ($active as $line) {
                if (str_starts_with($line, '=.id=')) $activeCount++;
            }

            fclose($conn->socket);

            return [
                'success' => true,
                'data' => [
                    'uptime'             => $stats['uptime'] ?? 'N/A',
                    'cpu_load'           => $stats['cpu-load'] ?? 'N/A',
                    'free_memory'        => $stats['free-memory'] ?? 'N/A',
                    'total_memory'       => $stats['total-memory'] ?? 'N/A',
                    'version'            => $stats['version'] ?? 'N/A',
                    'board_name'         => $stats['board-name'] ?? 'N/A',
                    'active_connections' => $activeCount,
                ],
            ];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}

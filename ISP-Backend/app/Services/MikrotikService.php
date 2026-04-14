<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\IpPool;
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
        stream_set_timeout($socket, 10);

        while (true) {
            $sentence = [];

            while (true) {
                $word = $this->readWord($socket);
                if ($word === false) {
                    break 2;
                }
                if ($word === '') {
                    break;
                }
                $sentence[] = $word;
            }

            if (empty($sentence)) {
                continue;
            }

            foreach ($sentence as $word) {
                $response[] = $word;
            }

            $replyType = $sentence[0] ?? null;
            if ($replyType === '!done' || $replyType === '!trap') {
                break;
            }
        }

        return $response;
    }

    protected function readWord($socket)
    {
        $byte = fread($socket, 1);
        if ($byte === false || $byte === '') return false;
        $len = ord($byte);

        if (($len & 0x80) !== 0) {
            if (($len & 0xC0) === 0x80) {
                $len = (($len & 0x3F) << 8) + ord(fread($socket, 1));
            } elseif (($len & 0xE0) === 0xC0) {
                $len = (($len & 0x1F) << 16) + (ord(fread($socket, 1)) << 8) + ord(fread($socket, 1));
            } elseif (($len & 0xF0) === 0xE0) {
                $len = (($len & 0x0F) << 24) + (ord(fread($socket, 1)) << 16) + (ord(fread($socket, 1)) << 8) + ord(fread($socket, 1));
            } else {
                $len = (ord(fread($socket, 1)) << 24) + (ord(fread($socket, 1)) << 16) + (ord(fread($socket, 1)) << 8) + ord(fread($socket, 1));
            }
        }

        if ($len === 0) return '';

        $data = '';
        while (strlen($data) < $len) {
            $chunk = fread($socket, $len - strlen($data));
            if ($chunk === false || $chunk === '') {
                return false;
            }
            $data .= $chunk;
        }

        return $data;
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

        $results = ['success' => true, 'synced' => 0, 'failed' => 0, 'total' => $customers->count()];

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

    /**
     * Import PPPoE secrets from router as customers.
     */
    public function importUsersFromRouter(string $routerId, ?string $tenantId = null): array
    {
        $router = MikrotikRouter::findOrFail($routerId);
        $conn = $this->connect($router);

        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $response = $this->sendCommand($conn, ['/ppp/secret/print']);
            $secrets = $this->parseItems($response);

            $customerQuery = $tenantId
                ? Customer::withoutGlobalScopes()->where('tenant_id', $tenantId)
                : Customer::query();
            $existingCustomers = $customerQuery
                ->whereNotNull('pppoe_username')
                ->pluck('id', 'pppoe_username')
                ->all();

            $packageQuery = $tenantId
                ? Package::withoutGlobalScopes()->where('tenant_id', $tenantId)
                : Package::query();
            $packages = $packageQuery
                ->get(['id', 'name', 'mikrotik_profile_name', 'monthly_price']);

            [$customerPrefix, $importCounter, $usesPrefix] = $this->resolveImportedCustomerSeed($tenantId);

            $imported = 0;
            $skipped = 0;
            $errors = [];

            foreach ($secrets as $secret) {
                $username = trim((string) ($secret['name'] ?? ''));
                if ($username === '') { $skipped++; continue; }
                if (isset($existingCustomers[$username])) { $skipped++; continue; }

                $profileName = trim((string) ($secret['profile'] ?? 'default'));
                $matchedPackage = $packages->first(function ($package) use ($profileName) {
                    return $package->mikrotik_profile_name === $profileName || $package->name === $profileName;
                });

                $importCounter++;
                $customerId = $usesPrefix
                    ? sprintf('%s-%05d', $customerPrefix, $importCounter)
                    : str_pad((string) max(100001, $importCounter), 6, '0', STR_PAD_LEFT);

                $isDisabled = in_array(strtolower((string) ($secret['disabled'] ?? 'false')), ['true', 'yes'], true);

                try {
                    $payload = [
                        'customer_id' => $customerId,
                        'name' => trim((string) ($secret['comment'] ?? '')) ?: $username,
                        'phone' => '01000000000',
                        'area' => 'Imported from MikroTik',
                        'pppoe_username' => $username,
                        'pppoe_password' => $secret['password'] ?? '',
                        'ip_address' => $secret['remote-address'] ?? null,
                        'router_id' => $routerId,
                        'package_id' => $matchedPackage?->id,
                        'monthly_bill' => (float) ($matchedPackage?->monthly_price ?? 0),
                        'status' => $isDisabled ? 'inactive' : 'active',
                        'connection_status' => $isDisabled ? 'suspended' : 'active',
                        'mikrotik_sync_status' => 'synced',
                    ];
                    if ($tenantId) {
                        $payload['tenant_id'] = $tenantId;
                    }

                    Customer::create($payload);
                    $existingCustomers[$username] = true;
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Failed to import {$username}: " . $e->getMessage();
                }
            }

            fclose($conn->socket);

            return [
                'success' => true,
                'imported' => $imported,
                'skipped' => $skipped,
                'errors' => $errors,
                'total' => count($secrets),
            ];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Import PPPoE profiles from router as packages.
     */
    public function importPackagesFromRouter(string $routerId, ?string $tenantId = null): array
    {
        $router = MikrotikRouter::findOrFail($routerId);
        $conn = $this->connect($router);

        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $response = $this->sendCommand($conn, ['/ppp/profile/print']);
            $profiles = $this->parseItems($response);

            $packageQuery = $tenantId
                ? Package::withoutGlobalScopes()->where('tenant_id', $tenantId)
                : Package::query();
            $existingPackages = $packageQuery->get(['name', 'mikrotik_profile_name']);

            $existingProfileNames = [];
            foreach ($existingPackages as $existingPackage) {
                if ($existingPackage->name) {
                    $existingProfileNames[strtolower(trim($existingPackage->name))] = true;
                }
                if ($existingPackage->mikrotik_profile_name) {
                    $existingProfileNames[strtolower(trim($existingPackage->mikrotik_profile_name))] = true;
                }
            }

            $imported = 0;
            $skipped = 0;
            $errors = [];

            foreach ($profiles as $profile) {
                $name = trim((string) ($profile['name'] ?? ''));
                if ($name === '' || in_array($name, ['default', 'default-encryption'], true)) {
                    $skipped++;
                    continue;
                }
                if (isset($existingProfileNames[strtolower($name)])) {
                    $skipped++;
                    continue;
                }

                $rateLimit = trim((string) ($profile['rate-limit'] ?? ''));
                $mainRate = preg_split('/\s+/', $rateLimit)[0] ?? '';
                $download = 0;
                $upload = 0;
                if ($mainRate && str_contains($mainRate, '/')) {
                    [$rawUpload, $rawDownload] = array_pad(explode('/', $mainRate, 2), 2, '');
                    $upload = $this->parseSpeed($rawUpload);
                    $download = $this->parseSpeed($rawDownload);
                }

                try {
                    $payload = [
                        'name' => $name,
                        'speed' => ($download ?: 10) . ' Mbps',
                        'monthly_price' => 0,
                        'download_speed' => $download ?: 10,
                        'upload_speed' => $upload ?: 10,
                        'mikrotik_profile_name' => $name,
                        'router_id' => $routerId,
                        'is_active' => true,
                    ];
                    if ($tenantId) {
                        $payload['tenant_id'] = $tenantId;
                    }

                    Package::create($payload);
                    $existingProfileNames[strtolower($name)] = true;
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Failed to import {$name}: " . $e->getMessage();
                }
            }

            fclose($conn->socket);

            return [
                'success' => true,
                'imported' => $imported,
                'skipped' => $skipped,
                'errors' => $errors,
                'total' => count($profiles),
            ];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Parse MikroTik API response items into associative arrays.
     */
    protected function parseItems(array $response): array
    {
        $items = [];
        $current = [];
        foreach ($response as $line) {
            if ($line === '!re') {
                if (!empty($current)) $items[] = $current;
                $current = [];
            } elseif (str_starts_with($line, '=') && str_contains($line, '=')) {
                $withoutPrefix = substr($line, 1); // remove leading =
                $eqPos = strpos($withoutPrefix, '=');
                if ($eqPos !== false) {
                    $key = substr($withoutPrefix, 0, $eqPos);
                    $val = substr($withoutPrefix, $eqPos + 1);
                    if ($key !== '.id') $current[$key] = $val;
                }
            }
        }
        if (!empty($current)) $items[] = $current;
        return $items;
    }

    /**
     * Parse speed value from MikroTik rate-limit string.
     */
    // ─── IP POOL SYNC & PUSH ────────────────────────────────

    /**
     * Sync IP pools from MikroTik router to database.
     */
    public function syncIpPools(string $routerId, ?string $tenantId = null): array
    {
        $router = MikrotikRouter::findOrFail($routerId);
        $conn = $this->connect($router);

        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $response = $this->sendCommand($conn, ['/ip/pool/print']);
            $pools = $this->parseItems($response);

            // Also preserve .id for push/update
            $poolsWithId = $this->parseItemsWithId($response);

            $synced = 0;
            $skipped = 0;

            foreach ($poolsWithId as $pool) {
                $name = $pool['name'] ?? null;
                if (!$name) { $skipped++; continue; }

                $ranges = $pool['ranges'] ?? '';

                // Parse ranges to start_ip / end_ip
                $startIp = '';
                $endIp = '';
                $totalIps = 0;
                if ($ranges) {
                    $parts = explode(',', $ranges);
                    $firstRange = trim($parts[0]);
                    if (str_contains($firstRange, '-')) {
                        [$startIp, $endIp] = explode('-', $firstRange, 2);
                        $totalIps = $this->calculateIpCount($startIp, $endIp);
                    } else {
                        $startIp = $firstRange;
                        $endIp = $firstRange;
                        $totalIps = 1;
                    }
                }

                $filter = ['router_id' => $routerId, 'name' => $name];
                if ($tenantId) $filter['tenant_id'] = $tenantId;

                IpPool::updateOrCreate($filter, [
                    'tenant_id' => $tenantId,
                    'router_id' => $routerId,
                    'ranges' => $ranges,
                    'start_ip' => trim($startIp),
                    'end_ip' => trim($endIp),
                    'total_ips' => $totalIps,
                    'subnet' => $ranges,
                    'status' => 'active',
                    'mikrotik_id' => $pool['.id'] ?? null,
                ]);
                $synced++;
            }

            fclose($conn->socket);

            return [
                'success' => true,
                'synced' => $synced,
                'skipped' => $skipped,
                'total' => count($pools),
            ];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Push an IP pool from SaaS to MikroTik router.
     */
    public function pushIpPool(IpPool $pool): array
    {
        if (!$pool->router) {
            return ['success' => false, 'error' => 'No router assigned'];
        }

        $conn = $this->connect($pool->router);
        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $ranges = $pool->ranges ?: ($pool->start_ip && $pool->end_ip ? "{$pool->start_ip}-{$pool->end_ip}" : '');

            if (!$ranges) {
                fclose($conn->socket);
                return ['success' => false, 'error' => 'No IP range defined'];
            }

            if ($pool->mikrotik_id) {
                // Update existing pool on router
                $this->sendCommand($conn, [
                    '/ip/pool/set',
                    '=.id=' . $pool->mikrotik_id,
                    '=name=' . $pool->name,
                    '=ranges=' . $ranges,
                ]);
            } else {
                // Check if pool with same name exists
                $existing = $this->sendCommand($conn, [
                    '/ip/pool/print',
                    '?name=' . $pool->name,
                ]);

                $existingId = null;
                foreach ($existing as $line) {
                    if (str_starts_with($line, '=.id=')) {
                        $existingId = substr($line, 4);
                    }
                }

                if ($existingId) {
                    $this->sendCommand($conn, [
                        '/ip/pool/set',
                        '=.id=' . $existingId,
                        '=ranges=' . $ranges,
                    ]);
                    $pool->update(['mikrotik_id' => $existingId]);
                } else {
                    $addResponse = $this->sendCommand($conn, [
                        '/ip/pool/add',
                        '=name=' . $pool->name,
                        '=ranges=' . $ranges,
                    ]);

                    // Extract new .id
                    foreach ($addResponse as $line) {
                        if (str_starts_with($line, '=ret=')) {
                            $pool->update(['mikrotik_id' => substr($line, 5)]);
                        }
                    }
                }
            }

            fclose($conn->socket);
            return ['success' => true, 'message' => "Pool '{$pool->name}' pushed to router"];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Delete an IP pool from MikroTik router.
     */
    public function removeIpPool(IpPool $pool): array
    {
        if (!$pool->router || !$pool->mikrotik_id) {
            return ['success' => false, 'error' => 'No router or MikroTik ID'];
        }

        $conn = $this->connect($pool->router);
        if (!$conn) {
            return ['success' => false, 'error' => 'Cannot connect to router'];
        }

        try {
            $this->sendCommand($conn, [
                '/ip/pool/remove',
                '=.id=' . $pool->mikrotik_id,
            ]);

            fclose($conn->socket);
            return ['success' => true, 'message' => "Pool '{$pool->name}' removed from router"];
        } catch (\Exception $e) {
            @fclose($conn->socket);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Parse items preserving .id field.
     */
    protected function parseItemsWithId(array $response): array
    {
        $items = [];
        $current = [];
        foreach ($response as $line) {
            if ($line === '!re') {
                if (!empty($current)) $items[] = $current;
                $current = [];
            } elseif (str_starts_with($line, '=') && str_contains($line, '=')) {
                $withoutPrefix = substr($line, 1);
                $eqPos = strpos($withoutPrefix, '=');
                if ($eqPos !== false) {
                    $key = substr($withoutPrefix, 0, $eqPos);
                    $val = substr($withoutPrefix, $eqPos + 1);
                    $current[$key] = $val;
                }
            }
        }
        if (!empty($current)) $items[] = $current;
        return $items;
    }

    /**
     * Calculate IP count from range.
     */
    protected function calculateIpCount(string $startIp, string $endIp): int
    {
        $start = ip2long(trim($startIp));
        $end = ip2long(trim($endIp));
        if ($start === false || $end === false) return 0;
        return abs($end - $start) + 1;
    }

    /**
     * Parse a MikroTik speed value like "10M", "5k", "100", "1G" to Mbps.
     */
    protected function parseSpeed(string $value): int
    {
        $value = trim(strtolower($value));
        $num = (float) $value;
        if ($num <= 0) return 0;
        if (str_ends_with($value, 'g')) return (int) round($num * 1000);
        if (str_ends_with($value, 'm')) return (int) round($num);
        if (str_ends_with($value, 'k')) return max(1, (int) round($num / 1000));
        // Plain number — likely bps
        if ($num > 1000000) return (int) round($num / 1000000);
        if ($num > 1000) return (int) round($num / 1000);
        return (int) round($num);
    }

    /**
     * Resolve customer_id seed for imports (detect prefix + max number).
     * Returns [$prefix, $maxNumber, $usesPrefix].
     */
    protected function resolveImportedCustomerSeed(?string $tenantId): array
    {
        $query = $tenantId
            ? Customer::withoutGlobalScopes()->where('tenant_id', $tenantId)
            : Customer::query();

        $customers = $query->select('customer_id')->orderByDesc('created_at')->limit(500)->get();

        $prefix = 'ISP';
        $maxNum = 0;
        $usesPrefix = false;

        foreach ($customers as $c) {
            if (preg_match('/^([A-Za-z]+)-(\d+)$/', $c->customer_id, $m)) {
                $usesPrefix = true;
                $prefix = $m[1];
                $num = (int) $m[2];
                if ($num > $maxNum) $maxNum = $num;
            } elseif (preg_match('/^(\d+)$/', $c->customer_id, $m)) {
                $num = (int) $m[1];
                if ($num > $maxNum) $maxNum = $num;
            }
        }

        if ($maxNum === 0) $maxNum = 100000;

        return [$prefix, $maxNum, $usesPrefix];
    }
}

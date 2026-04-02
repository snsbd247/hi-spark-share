<?php

namespace App\Jobs;

use App\Models\IpPool;
use App\Models\MikrotikRouter;
use App\Services\MikrotikService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncIpPoolsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(
        protected string $routerId,
        protected ?string $tenantId = null
    ) {}

    public function handle(MikrotikService $service): void
    {
        try {
            $result = $service->syncIpPools($this->routerId, $this->tenantId);
            Log::info('SyncIpPoolsJob completed', $result);
        } catch (\Exception $e) {
            Log::error('SyncIpPoolsJob failed: ' . $e->getMessage());
            throw $e;
        }
    }
}

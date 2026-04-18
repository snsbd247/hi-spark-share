<?php

namespace App\Services\Fiber\Adapters;

use App\Models\OltDevice;

/**
 * Vendor-agnostic OLT adapter contract.
 * Implementations MUST NOT throw on connection failure — return structured result.
 */
interface OltAdapterInterface
{
    public function vendor(): string;

    /**
     * Try to connect and return basic system info.
     * @return array{ ok:bool, mode:string, message?:string, raw?:string }
     */
    public function testConnection(OltDevice $device, string $plainPassword): array;

    /**
     * Fetch all ONUs with live signal & status.
     * @return array{ ok:bool, mode:string, onus:array<int,array>, raw?:string, error?:string }
     */
    public function fetchOnus(OltDevice $device, string $plainPassword): array;
}

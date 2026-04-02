<?php

namespace App\Services;

use App\Models\CustomerDevice;
use App\Models\InventoryLog;
use App\Models\Product;
use App\Models\ProductSerial;
use Illuminate\Support\Facades\DB;

class DeviceAssignmentService
{
    public function __construct(protected InventoryService $inventoryService) {}

    /**
     * Assign a device to a customer.
     */
    public function assignDevice(array $data): CustomerDevice
    {
        return DB::transaction(function () use ($data) {
            // Mark serial as assigned if provided
            if (!empty($data['serial_number'])) {
                $serial = ProductSerial::where('serial_number', $data['serial_number'])->first();
                if ($serial && $serial->status !== 'available') {
                    throw new \Exception("Serial '{$data['serial_number']}' is not available (current: {$serial->status})");
                }
                if ($serial) {
                    $serial->update(['status' => 'assigned']);
                }
            }

            // Decrease stock
            if (!empty($data['product_id'])) {
                $this->inventoryService->decreaseStock($data['product_id'], 1);

                InventoryLog::create([
                    'product_id'     => $data['product_id'],
                    'type'           => 'out',
                    'quantity'       => 1,
                    'note'           => 'Device assigned to customer ' . ($data['customer_id'] ?? ''),
                    'reference_type' => 'customer_device',
                    'created_at'     => now(),
                ]);
            }

            return CustomerDevice::create([
                'customer_id'   => $data['customer_id'],
                'product_id'    => $data['product_id'] ?? null,
                'serial_number' => $data['serial_number'] ?? null,
                'mac_address'   => $data['mac_address'] ?? null,
                'ip_address'    => $data['ip_address'] ?? null,
                'assigned_at'   => now(),
                'status'        => 'active',
                'notes'         => $data['notes'] ?? null,
            ]);
        });
    }

    /**
     * Return a device from a customer.
     */
    public function returnDevice(string $deviceId): CustomerDevice
    {
        return DB::transaction(function () use ($deviceId) {
            $device = CustomerDevice::findOrFail($deviceId);
            $device->update(['status' => 'returned']);

            // Re-stock
            if ($device->product_id) {
                $this->inventoryService->increaseStock($device->product_id, 1);

                InventoryLog::create([
                    'product_id'     => $device->product_id,
                    'type'           => 'return',
                    'quantity'       => 1,
                    'note'           => 'Device returned from customer',
                    'reference_type' => 'customer_device',
                    'reference_id'   => $device->id,
                    'created_at'     => now(),
                ]);
            }

            // Mark serial available
            if ($device->serial_number) {
                ProductSerial::where('serial_number', $device->serial_number)
                    ->update(['status' => 'available']);
            }

            return $device->fresh();
        });
    }
}

<?php

namespace App\Console\Commands;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\SmsTemplate;
use App\Services\SmsService;
use Illuminate\Console\Command;

class AutoSuspend extends Command
{
    protected $signature = 'customers:auto-suspend {--days=7}';
    protected $description = 'Auto-suspend customers with overdue bills';

    public function handle(SmsService $smsService)
    {
        $days = (int) $this->option('days');
        $cutoff = now()->subDays($days);

        $overdueCustomerIds = Bill::where('status', 'unpaid')
            ->where('due_date', '<', $cutoff)
            ->pluck('customer_id')
            ->unique();

        $count = 0;
        foreach ($overdueCustomerIds as $customerId) {
            $customer = Customer::find($customerId);
            if ($customer && $customer->status === 'active') {
                $customer->update(['status' => 'suspended']);
                $count++;

                // Send suspension SMS
                if ($customer->phone) {
                    try {
                        $tpl = SmsTemplate::where('name', 'Account Suspension')->first();
                        $templateMsg = $tpl->message ?? 'Dear {CustomerName}, your internet service has been suspended due to overdue payment. Please pay your bill to restore service. Customer ID: {CustomerID}.';
                        $smsMessage = str_replace(
                            ['{CustomerName}', '{CustomerID}'],
                            [$customer->name, $customer->customer_id],
                            $templateMsg
                        );
                        $smsService->send($customer->phone, $smsMessage, 'suspension', $customer->id);
                    } catch (\Exception $e) {
                        // SMS failure should not block suspension
                    }
                }
            }
        }

        $this->info("Suspended {$count} customers with bills overdue by {$days}+ days.");
        return 0;
    }
}

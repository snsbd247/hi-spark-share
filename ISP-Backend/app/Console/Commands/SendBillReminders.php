<?php

namespace App\Console\Commands;

use App\Models\Bill;
use App\Models\SmsTemplate;
use App\Services\SmsService;
use Illuminate\Console\Command;

class SendBillReminders extends Command
{
    protected $signature = 'bills:send-reminders';
    protected $description = 'Send SMS reminders for upcoming and overdue bills';

    public function handle(SmsService $smsService)
    {
        $today = now()->toDateString();
        $tomorrow = now()->addDay()->toDateString();
        $in5Days = now()->addDays(5)->toDateString();

        $bills = Bill::where('status', 'unpaid')
            ->whereNotNull('due_date')
            ->with('customer:id,customer_id,name,phone')
            ->get();

        $sent = 0;

        foreach ($bills as $bill) {
            if (!$bill->customer || !$bill->customer->phone) continue;

            $dueDate = $bill->due_date instanceof \Carbon\Carbon
                ? $bill->due_date->toDateString()
                : $bill->due_date;

            $smsType = '';
            $message = '';
            $customer = $bill->customer;

            if ($dueDate === $tomorrow) {
                $smsType = 'bill_reminder';
                $tpl = SmsTemplate::where('name', 'Bill Reminder')->first();
                $templateMsg = $tpl->message ?? 'Reminder: Your internet bill of {Amount} BDT is due tomorrow ({DueDate}). Please pay to avoid service suspension.';
                $message = str_replace(
                    ['{CustomerName}', '{Amount}', '{Month}', '{DueDate}', '{CustomerID}'],
                    [$customer->name, $bill->amount, $bill->month, $dueDate, $customer->customer_id],
                    $templateMsg
                );
            } elseif ($dueDate === $in5Days) {
                $smsType = 'bill_reminder';
                $message = "Dear {$customer->name}, your internet bill of {$bill->amount} BDT for {$bill->month} is due in 5 days. Please pay to avoid service interruption.";
            } elseif ($dueDate === $today) {
                $smsType = 'due_date';
                $message = "Dear {$customer->name}, your internet bill of {$bill->amount} BDT for {$bill->month} is due today. Please pay immediately to avoid service suspension.";
            } elseif ($dueDate < $today) {
                $smsType = 'overdue';
                $message = "Dear {$customer->name}, your internet bill of {$bill->amount} BDT for {$bill->month} is overdue. Your service may be suspended. Please pay immediately.";
            }

            if ($smsType && $message) {
                try {
                    $smsService->send($customer->phone, $message, $smsType, $customer->id);
                    $sent++;
                } catch (\Exception $e) {
                    $this->warn("Failed to send SMS to {$customer->phone}: {$e->getMessage()}");
                }
            }
        }

        $this->info("Sent {$sent} bill reminder SMS.");
        return 0;
    }
}

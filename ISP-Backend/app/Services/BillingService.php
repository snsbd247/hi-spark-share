<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\SmsTemplate;
use Illuminate\Support\Str;

class BillingService
{
    public function __construct(
        protected LedgerService $ledgerService,
        protected SmsService $smsService
    ) {}

    public function generateMonthlyBills(string $month): array
    {
        $customers = Customer::where('status', 'active')->get();
        $created = 0;
        $skipped = 0;
        $smsSent = 0;

        foreach ($customers as $customer) {
            $exists = Bill::where('customer_id', $customer->id)
                ->where('month', $month)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            $amount = $customer->monthly_bill - ($customer->discount ?? 0);

            $dueDay = $customer->due_date_day ?? 15;
            $monthDate = \Carbon\Carbon::parse($month . '-01');
            $dueDate = $monthDate->copy()->day(min($dueDay, $monthDate->daysInMonth));

            $bill = Bill::create([
                'customer_id' => $customer->id,
                'month' => $month,
                'amount' => max(0, $amount),
                'status' => 'unpaid',
                'due_date' => $dueDate,
                'payment_link_token' => Str::random(32),
            ]);

            // Customer ledger debit
            $this->ledgerService->addDebit(
                $customer->id,
                $bill->amount,
                "Bill - {$month}",
                $bill->id
            );

            // Send bill generation SMS
            if ($customer->phone) {
                try {
                    $this->sendBillGenerationSms($customer, $bill);
                    $smsSent++;
                } catch (\Exception $e) {
                    // SMS failure should not block bill generation
                }
            }

            $created++;
        }

        return [
            'success' => true,
            'created' => $created,
            'skipped' => $skipped,
            'sms_sent' => $smsSent,
            'month' => $month,
        ];
    }

    public function createBill(string $customerId, string $month, float $amount, ?string $dueDate = null): Bill
    {
        $bill = Bill::create([
            'customer_id' => $customerId,
            'month' => $month,
            'amount' => $amount,
            'status' => 'unpaid',
            'due_date' => $dueDate,
            'payment_link_token' => Str::random(32),
        ]);

        $this->ledgerService->addDebit($customerId, $amount, "Bill - {$month}", $bill->id);

        return $bill;
    }

    public function markBillPaid(Bill $bill): void
    {
        $bill->update([
            'status' => 'paid',
            'paid_date' => now(),
        ]);
    }

    /**
     * Send bill generation SMS to customer using template.
     */
    protected function sendBillGenerationSms(Customer $customer, Bill $bill): void
    {
        $tpl = SmsTemplate::where('name', 'Bill Generate')->first();
        $templateMsg = $tpl->message ?? 'Dear {CustomerName}, your internet bill of {Amount} BDT for {Month} has been generated. Due date: {DueDate}. Please pay on time.';

        $smsMessage = str_replace(
            ['{CustomerName}', '{Amount}', '{Month}', '{DueDate}', '{CustomerID}'],
            [
                $customer->name,
                $bill->amount,
                $bill->month,
                $bill->due_date ? \Carbon\Carbon::parse($bill->due_date)->format('d/m/Y') : 'N/A',
                $customer->customer_id,
            ],
            $templateMsg
        );

        $this->smsService->send($customer->phone, $smsMessage, 'bill_generate', $customer->id);
    }

    /**
     * Send new customer bill SMS (when a new customer is added and billed).
     */
    public function sendNewCustomerBillSms(Customer $customer, Bill $bill): void
    {
        $tpl = SmsTemplate::where('name', 'New Customer Bill')->first();
        $templateMsg = $tpl->message ?? 'Dear {CustomerName}, welcome! Your first bill of {Amount} BDT for {Month} has been generated. Due date: {DueDate}. Customer ID: {CustomerID}.';

        $smsMessage = str_replace(
            ['{CustomerName}', '{Amount}', '{Month}', '{DueDate}', '{CustomerID}'],
            [
                $customer->name,
                $bill->amount,
                $bill->month,
                $bill->due_date ? \Carbon\Carbon::parse($bill->due_date)->format('d/m/Y') : 'N/A',
                $customer->customer_id,
            ],
            $templateMsg
        );

        $this->smsService->send($customer->phone, $smsMessage, 'new_customer_bill', $customer->id);
    }
}

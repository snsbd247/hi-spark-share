<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Customer;
use Illuminate\Support\Str;

class BillingService
{
    public function __construct(protected LedgerService $ledgerService) {}

    public function generateMonthlyBills(string $month): array
    {
        $customers = Customer::where('status', 'active')->get();
        $created = 0;
        $skipped = 0;

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

            $created++;
        }

        return [
            'success' => true,
            'created' => $created,
            'skipped' => $skipped,
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
}

<?php

namespace App\Services;

use App\Models\Account;
use App\Models\CustomerLedger;
use App\Models\SystemSetting;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class LedgerService
{
    public function getBalance(string $customerId): float
    {
        $lastEntry = CustomerLedger::where('customer_id', $customerId)
            ->orderBy('created_at', 'desc')
            ->first();

        return $lastEntry ? (float) $lastEntry->balance : 0;
    }

    public function addDebit(string $customerId, float $amount, string $description, ?string $reference = null): CustomerLedger
    {
        $balance = $this->getBalance($customerId);
        $newBalance = $balance + $amount;

        return CustomerLedger::create([
            'customer_id' => $customerId,
            'date' => now()->toDateString(),
            'type' => 'bill',
            'description' => $description,
            'debit' => $amount,
            'credit' => 0,
            'balance' => $newBalance,
            'reference' => $reference,
        ]);
    }

    public function addCredit(string $customerId, float $amount, string $description, ?string $reference = null): CustomerLedger
    {
        $balance = $this->getBalance($customerId);
        $newBalance = $balance - $amount;

        return CustomerLedger::create([
            'customer_id' => $customerId,
            'date' => now()->toDateString(),
            'type' => 'payment',
            'description' => $description,
            'debit' => 0,
            'credit' => $amount,
            'balance' => $newBalance,
            'reference' => $reference,
        ]);
    }

    /**
     * Post a double-entry to the accounting ledger based on system_settings mapping.
     *
     * @param string $settingKeyDebit  e.g. 'sales_cash_account', 'service_income_account'
     * @param string $settingKeyCredit e.g. 'sales_income_account', 'expense_cash_account'
     * @param float  $amount
     * @param string $description
     * @param string $type  Transaction type: 'income', 'expense', 'journal', 'payment', 'bill'
     * @param string|null $reference
     * @param string|null $createdBy
     */
    public function postToAccounting(
        string $settingKeyDebit,
        string $settingKeyCredit,
        float $amount,
        string $description,
        string $type = 'journal',
        ?string $reference = null,
        ?string $createdBy = null
    ): void {
        $debitAccountId = $this->getSettingValue($settingKeyDebit);
        $creditAccountId = $this->getSettingValue($settingKeyCredit);

        if (!$debitAccountId || !$creditAccountId) {
            return; // Silently skip if accounts not mapped
        }

        $debitAccount = Account::find($debitAccountId);
        $creditAccount = Account::find($creditAccountId);

        if (!$debitAccount || !$creditAccount) {
            return;
        }

        DB::transaction(function () use ($debitAccount, $creditAccount, $amount, $description, $type, $reference, $createdBy) {
            // Debit entry
            Transaction::create([
                'type' => $type,
                'debit' => $amount,
                'credit' => 0,
                'date' => now()->toDateString(),
                'description' => $description,
                'account_id' => $debitAccount->id,
                'reference' => $reference,
                'created_by' => $createdBy,
            ]);

            // Credit entry
            Transaction::create([
                'type' => $type,
                'debit' => 0,
                'credit' => $amount,
                'date' => now()->toDateString(),
                'description' => $description,
                'account_id' => $creditAccount->id,
                'reference' => $reference,
                'created_by' => $createdBy,
            ]);

            // Update account balances (account-type-aware)
            if (in_array($debitAccount->type, ['asset', 'expense'])) {
                $debitAccount->increment('balance', $amount);
            } else {
                $debitAccount->decrement('balance', $amount);
            }

            if (in_array($creditAccount->type, ['asset', 'expense'])) {
                $creditAccount->decrement('balance', $amount);
            } else {
                $creditAccount->increment('balance', $amount);
            }
        });
    }

    /**
     * Get a system_settings value by key.
     */
    protected function getSettingValue(string $key): ?string
    {
        $setting = SystemSetting::where('setting_key', $key)->first();
        return $setting?->setting_value;
    }

    /**
     * Post service income (ISP bill payment) to accounting.
     */
    public function postServiceIncome(float $amount, string $description, ?string $reference = null, ?string $createdBy = null): void
    {
        // Dr. Cash/Bank (monthly_bill_account_id or service income cash)
        // Cr. Service Income (service_income_account)
        $cashAccountId = $this->getSettingValue('monthly_bill_account_id')
            ?: $this->getSettingValue('sales_cash_account');
        $incomeAccountId = $this->getSettingValue('service_income_account');

        if ($cashAccountId && $incomeAccountId) {
            $this->postToAccounting(
                'monthly_bill_account_id',
                'service_income_account',
                $amount,
                $description,
                'income',
                $reference,
                $createdBy
            );
        }
    }

    /**
     * Post merchant payment to accounting.
     */
    public function postMerchantPayment(float $amount, string $description, ?string $reference = null, ?string $createdBy = null): void
    {
        $merchantAccountId = $this->getSettingValue('merchant_payment_account_id');
        $incomeAccountId = $this->getSettingValue('service_income_account');

        if ($merchantAccountId && $incomeAccountId) {
            $debitAccount = Account::find($merchantAccountId);
            $creditAccount = Account::find($incomeAccountId);

            if ($debitAccount && $creditAccount) {
                DB::transaction(function () use ($debitAccount, $creditAccount, $amount, $description, $reference, $createdBy) {
                    Transaction::create([
                        'type' => 'income',
                        'debit' => $amount,
                        'credit' => 0,
                        'date' => now()->toDateString(),
                        'description' => $description,
                        'account_id' => $debitAccount->id,
                        'reference' => $reference,
                        'created_by' => $createdBy,
                    ]);

                    Transaction::create([
                        'type' => 'income',
                        'debit' => 0,
                        'credit' => $amount,
                        'date' => now()->toDateString(),
                        'description' => $description,
                        'account_id' => $creditAccount->id,
                        'reference' => $reference,
                        'created_by' => $createdBy,
                    ]);

                    if (in_array($debitAccount->type, ['asset', 'expense'])) {
                        $debitAccount->increment('balance', $amount);
                    } else {
                        $debitAccount->decrement('balance', $amount);
                    }

                    if (in_array($creditAccount->type, ['asset', 'expense'])) {
                        $creditAccount->decrement('balance', $amount);
                    } else {
                        $creditAccount->increment('balance', $amount);
                    }
                });
            }
        }
    }

    /**
     * Post connection charge to accounting.
     */
    public function postConnectionCharge(float $amount, string $description, ?string $reference = null, ?string $createdBy = null): void
    {
        $cashAccountId = $this->getSettingValue('connection_charge_account_id');
        if (!$cashAccountId) return;

        $cashAccount = Account::find($cashAccountId);
        if (!$cashAccount) return;

        DB::transaction(function () use ($cashAccount, $amount, $description, $reference, $createdBy) {
            Transaction::create([
                'type' => 'income',
                'debit' => $amount,
                'credit' => 0,
                'date' => now()->toDateString(),
                'description' => $description,
                'account_id' => $cashAccount->id,
                'reference' => $reference,
                'created_by' => $createdBy,
            ]);

            if (in_array($cashAccount->type, ['asset', 'expense'])) {
                $cashAccount->increment('balance', $amount);
            } else {
                $cashAccount->increment('balance', $amount);
            }
        });
    }

    /**
     * Recalculate customer ledger running balance after deletion.
     */
    public function recalculateCustomerBalance(string $customerId): void
    {
        $entries = CustomerLedger::where('customer_id', $customerId)
            ->orderBy('created_at', 'asc')
            ->get();

        $runningBalance = 0;
        foreach ($entries as $entry) {
            $runningBalance += (float) $entry->debit - (float) $entry->credit;
            if ((float) $entry->balance !== $runningBalance) {
                $entry->update(['balance' => $runningBalance]);
            }
        }
    }

    /**
     * Reverse accounting entries for a payment deletion.
     * Reverses the account balances that were affected.
     */
    public function reverseServiceIncome(float $amount, ?string $reference = null): void
    {
        $cashAccountId = $this->getSettingValue('monthly_bill_account_id')
            ?: $this->getSettingValue('sales_cash_account');
        $incomeAccountId = $this->getSettingValue('service_income_account');

        // Delete the transaction records
        if ($reference) {
            Transaction::where('reference', $reference)->where('type', 'income')->delete();
        }

        // Reverse account balances
        if ($cashAccountId) {
            $cashAccount = Account::find($cashAccountId);
            if ($cashAccount) {
                if (in_array($cashAccount->type, ['asset', 'expense'])) {
                    $cashAccount->decrement('balance', $amount);
                } else {
                    $cashAccount->increment('balance', $amount);
                }
            }
        }

        if ($incomeAccountId) {
            $incomeAccount = Account::find($incomeAccountId);
            if ($incomeAccount) {
                if (in_array($incomeAccount->type, ['asset', 'expense'])) {
                    $incomeAccount->increment('balance', $amount);
                } else {
                    $incomeAccount->decrement('balance', $amount);
                }
            }
        }
    }
}

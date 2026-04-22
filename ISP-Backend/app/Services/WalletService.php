<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\CustomerWallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * WalletService — handles all customer wallet credit/debit operations
 * with strict double-entry accounting + row-level locking for concurrency safety.
 *
 * NOTE: All operations are tenant-scoped via BelongsToTenant trait on the models.
 * Existing modules (Bills, Payments, MikroTik, SMS, Email) are untouched.
 */
class WalletService
{
    public function __construct(protected AccountingService $accounting) {}

    /**
     * COA codes used by the wallet module (auto-created per tenant).
     *  - 1001  : Cash in Hand            (Asset)  — fallback debit account
     *  - 2050  : Customer Wallet Liability (Liability) — wallet balance owed to customers
     *  - 4001  : Monthly Subscription Income (Income) — bill revenue
     */
    public const ACC_CASH               = '1001';
    public const ACC_WALLET_LIABILITY   = '2050';
    public const ACC_BILL_REVENUE       = '4001';

    /**
     * Ensure default Wallet COA accounts exist for the given tenant.
     * Idempotent — safe to call repeatedly.
     */
    public function ensureWalletAccounts(?string $tenantId = null): void
    {
        $tenantId = $tenantId ?? (function_exists('tenant_id') ? tenant_id() : null);

        $this->accounting->ensureAccount([
            'code' => self::ACC_WALLET_LIABILITY,
            'name' => 'Customer Wallet Liability',
            'type' => 'liability',
            'level' => 1,
        ], $tenantId);
    }

    /**
     * Get or create the wallet row for a customer (tenant-scoped, locked).
     */
    protected function lockWallet(string $customerId): CustomerWallet
    {
        $tenantId = function_exists('tenant_id') ? tenant_id() : null;

        // Insert-if-missing path (no lock needed since unique index protects it)
        $wallet = CustomerWallet::where('customer_id', $customerId)->first();
        if (!$wallet) {
            $wallet = CustomerWallet::create([
                'tenant_id'   => $tenantId,
                'customer_id' => $customerId,
                'balance'     => 0,
                'status'      => 'active',
                'auto_pay'    => true,
            ]);
        }

        // Re-fetch with row lock inside the transaction
        return CustomerWallet::where('id', $wallet->id)->lockForUpdate()->first();
    }

    public function getBalance(string $customerId): float
    {
        $w = CustomerWallet::where('customer_id', $customerId)->first();
        return $w ? (float) $w->balance : 0.0;
    }

    public function getWallet(string $customerId): CustomerWallet
    {
        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        return CustomerWallet::firstOrCreate(
            ['customer_id' => $customerId],
            ['tenant_id' => $tenantId, 'balance' => 0, 'status' => 'active', 'auto_pay' => true]
        );
    }

    /**
     * Credit wallet (top-up). Creates: Dr Cash/Bank, Cr Customer Wallet Liability.
     *
     * @param array $opts source, gateway, reference_id, reference_type, description, created_by, cash_account_id, auto_pay_after
     */
    public function credit(string $customerId, float $amount, array $opts = []): WalletTransaction
    {
        if ($amount <= 0) {
            throw new RuntimeException('Credit amount must be positive.');
        }

        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        $this->ensureWalletAccounts($tenantId);

        return DB::transaction(function () use ($customerId, $amount, $opts, $tenantId) {
            $wallet = $this->lockWallet($customerId);

            if ($wallet->status !== 'active') {
                throw new RuntimeException('Wallet is frozen.');
            }

            $newBalance = round((float) $wallet->balance + $amount, 2);
            $wallet->balance = $newBalance;
            $wallet->save();

            $txn = WalletTransaction::create([
                'tenant_id'      => $tenantId,
                'customer_id'    => $customerId,
                'type'           => 'credit',
                'amount'         => $amount,
                'source'         => $opts['source'] ?? 'payment',
                'gateway'        => $opts['gateway'] ?? null,
                'reference_id'   => $opts['reference_id'] ?? null,
                'reference_type' => $opts['reference_type'] ?? null,
                'description'    => $opts['description'] ?? 'Wallet top-up',
                'balance_after'  => $newBalance,
                'created_by'     => $opts['created_by'] ?? null,
            ]);

            // ── Double-entry: Dr Cash/Bank, Cr Wallet Liability ────────
            $cashAcct = isset($opts['cash_account_id'])
                ? Account::find($opts['cash_account_id'])
                : $this->accounting->accountByCode(self::ACC_CASH, $tenantId);
            $walletLiab = $this->accounting->accountByCode(self::ACC_WALLET_LIABILITY, $tenantId);

            if ($cashAcct && $walletLiab) {
                try {
                    $ref = $this->accounting->createJournalEntry([
                        ['account_id' => $cashAcct->id, 'debit' => $amount, 'credit' => 0,
                         'description' => 'Wallet credit — '.($opts['description'] ?? '')],
                        ['account_id' => $walletLiab->id, 'debit' => 0, 'credit' => $amount,
                         'description' => 'Wallet liability increase'],
                    ], 'Customer Wallet Credit', $opts['created_by'] ?? null);

                    // Stash the journal ref onto the txn description (no schema change)
                    $txn->update(['description' => trim(($txn->description ?? '').' ['.$ref.']')]);
                } catch (\Throwable $e) {
                    Log::warning('Wallet credit JE failed: '.$e->getMessage());
                }
            }

            return $txn;
        });
    }

    /**
     * Debit wallet (e.g. invoice auto-pay).
     * Creates: Dr Customer Wallet Liability, Cr Revenue.
     */
    public function debit(string $customerId, float $amount, array $opts = []): WalletTransaction
    {
        if ($amount <= 0) {
            throw new RuntimeException('Debit amount must be positive.');
        }

        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        $this->ensureWalletAccounts($tenantId);

        return DB::transaction(function () use ($customerId, $amount, $opts, $tenantId) {
            $wallet = $this->lockWallet($customerId);

            if ($wallet->status !== 'active') {
                throw new RuntimeException('Wallet is frozen.');
            }
            if ((float) $wallet->balance + 0.001 < $amount) {
                throw new RuntimeException('Insufficient wallet balance.');
            }

            $newBalance = round((float) $wallet->balance - $amount, 2);
            $wallet->balance = $newBalance;
            $wallet->save();

            $txn = WalletTransaction::create([
                'tenant_id'      => $tenantId,
                'customer_id'    => $customerId,
                'type'           => 'debit',
                'amount'         => $amount,
                'source'         => $opts['source'] ?? 'invoice',
                'reference_id'   => $opts['reference_id'] ?? null,
                'reference_type' => $opts['reference_type'] ?? null,
                'description'    => $opts['description'] ?? 'Wallet debit',
                'balance_after'  => $newBalance,
                'created_by'     => $opts['created_by'] ?? null,
            ]);

            $walletLiab = $this->accounting->accountByCode(self::ACC_WALLET_LIABILITY, $tenantId);
            $revenue = isset($opts['revenue_account_id'])
                ? Account::find($opts['revenue_account_id'])
                : $this->accounting->accountByCode(self::ACC_BILL_REVENUE, $tenantId);

            if ($walletLiab && $revenue) {
                try {
                    $ref = $this->accounting->createJournalEntry([
                        ['account_id' => $walletLiab->id, 'debit' => $amount, 'credit' => 0,
                         'description' => 'Wallet liability decrease'],
                        ['account_id' => $revenue->id, 'debit' => 0, 'credit' => $amount,
                         'description' => 'Revenue from wallet — '.($opts['description'] ?? '')],
                    ], 'Customer Wallet Debit', $opts['created_by'] ?? null);

                    $txn->update(['description' => trim(($txn->description ?? '').' ['.$ref.']')]);
                } catch (\Throwable $e) {
                    Log::warning('Wallet debit JE failed: '.$e->getMessage());
                }
            }

            return $txn;
        });
    }

    /**
     * Auto-pay an invoice from wallet if balance is sufficient.
     * Returns ['paid' => bool, 'amount' => float, 'transaction' => ?WalletTransaction].
     */
    public function autoPayInvoice(string $billId, ?string $createdBy = null): array
    {
        $bill = Bill::find($billId);
        if (!$bill) {
            return ['paid' => false, 'reason' => 'bill_not_found', 'amount' => 0];
        }
        if ($bill->status === 'paid') {
            return ['paid' => false, 'reason' => 'already_paid', 'amount' => 0];
        }

        $due = max(0, (float) $bill->amount - (float) $bill->paid_amount);
        if ($due <= 0) {
            return ['paid' => false, 'reason' => 'no_due', 'amount' => 0];
        }

        $wallet = $this->getWallet($bill->customer_id);
        if (!$wallet->auto_pay) {
            return ['paid' => false, 'reason' => 'auto_pay_disabled', 'amount' => 0];
        }
        if ((float) $wallet->balance + 0.001 < $due) {
            return ['paid' => false, 'reason' => 'insufficient_balance', 'amount' => 0];
        }

        $txn = $this->debit($bill->customer_id, $due, [
            'source'         => 'invoice',
            'reference_id'   => $bill->id,
            'reference_type' => 'bill',
            'description'    => "Auto-pay bill {$bill->month}",
            'created_by'     => $createdBy,
        ]);

        $bill->paid_amount = (float) $bill->paid_amount + $due;
        $bill->status     = 'paid';
        $bill->paid_date  = now()->toDateString();
        $bill->save();

        return ['paid' => true, 'amount' => $due, 'transaction' => $txn, 'bill' => $bill];
    }

    /**
     * Refund a previous payment back into the wallet (manual or gateway-initiated).
     */
    public function refund(string $customerId, float $amount, array $opts = []): WalletTransaction
    {
        return $this->credit($customerId, $amount, array_merge([
            'source'      => 'refund',
            'description' => $opts['description'] ?? 'Refund to wallet',
        ], $opts));
    }

    /**
     * Freeze / unfreeze wallet (admin action).
     */
    public function setStatus(string $customerId, string $status): CustomerWallet
    {
        $wallet = $this->getWallet($customerId);
        $wallet->status = $status;
        $wallet->save();
        return $wallet;
    }

    public function setAutoPay(string $customerId, bool $autoPay): CustomerWallet
    {
        $wallet = $this->getWallet($customerId);
        $wallet->auto_pay = $autoPay;
        $wallet->save();
        return $wallet;
    }
}

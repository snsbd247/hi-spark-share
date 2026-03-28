<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    /**
     * Create a double-entry journal entry.
     */
    public function createJournalEntry(array $entries, ?string $description = null, ?string $createdBy = null): string
    {
        $totalDebit = collect($entries)->sum('debit');
        $totalCredit = collect($entries)->sum('credit');

        if (abs($totalDebit - $totalCredit) > 0.01) {
            throw new \InvalidArgumentException('Debit and Credit must be equal.');
        }

        DB::transaction(function () use ($entries, $description, $createdBy) {
            foreach ($entries as $entry) {
                $debit = $entry['debit'] ?? 0;
                $credit = $entry['credit'] ?? 0;

                Transaction::create([
                    'type'        => 'journal',
                    'debit'       => $debit,
                    'credit'      => $credit,
                    'date'        => $entry['date'] ?? now(),
                    'description' => $entry['description'] ?? $description ?? '',
                    'account_id'  => $entry['account_id'],
                    'created_by'  => $createdBy,
                ]);

                $account = Account::find($entry['account_id']);
                if ($account) {
                    if (in_array($account->type, ['asset', 'expense'])) {
                        $account->increment('balance', $debit - $credit);
                    } else {
                        $account->increment('balance', $credit - $debit);
                    }
                }
            }
        });

        return 'JE-' . now()->format('YmdHis');
    }

    /**
     * Record an income transaction.
     */
    public function recordIncome(array $data): Transaction
    {
        return DB::transaction(function () use ($data) {
            $amount = $data['amount'];
            $txn = Transaction::create([
                'type'        => 'income',
                'debit'       => $amount,
                'credit'      => 0,
                'date'        => $data['date'] ?? now(),
                'description' => $data['description'] ?? '',
                'account_id'  => $data['account_id'] ?? null,
                'created_by'  => $data['created_by'] ?? null,
            ]);

            if ($txn->account_id) {
                Account::where('id', $txn->account_id)->increment('balance', $amount);
            }

            return $txn;
        });
    }

    /**
     * Record an expense transaction.
     */
    public function recordExpense(array $data): Transaction
    {
        return DB::transaction(function () use ($data) {
            $amount = $data['amount'];
            $txn = Transaction::create([
                'type'        => 'expense',
                'debit'       => 0,
                'credit'      => $amount,
                'date'        => $data['date'] ?? now(),
                'description' => $data['description'] ?? '',
                'account_id'  => $data['account_id'] ?? null,
                'created_by'  => $data['created_by'] ?? null,
            ]);

            if ($txn->account_id) {
                Account::where('id', $txn->account_id)->decrement('balance', $amount);
            }

            return $txn;
        });
    }

    public function getFinancialSummary(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfMonth()->toDateString();
        $to   = $to ?? now()->endOfMonth()->toDateString();

        $income = Transaction::where('type', 'income')
            ->whereBetween('date', [$from, $to])->sum('debit');
        $expense = Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])->sum('credit');

        return [
            'from' => $from, 'to' => $to,
            'total_income'  => (float) $income,
            'total_expense' => (float) $expense,
            'net_profit'    => (float) ($income - $expense),
        ];
    }

    public function getAccountBalances(): array
    {
        $accounts = Account::where('is_active', true)->orderBy('type')->orderBy('code')->get();

        $grouped = $accounts->groupBy('type')->map(function ($group) {
            return [
                'accounts'      => $group->toArray(),
                'total_balance' => $group->sum('balance'),
            ];
        });

        return [
            'accounts'          => $grouped,
            'total_assets'      => (float) $accounts->where('type', 'asset')->sum('balance'),
            'total_liabilities' => (float) $accounts->where('type', 'liability')->sum('balance'),
            'total_income'      => (float) $accounts->where('type', 'income')->sum('balance'),
            'total_expense'     => (float) $accounts->where('type', 'expense')->sum('balance'),
            'total_equity'      => (float) $accounts->where('type', 'equity')->sum('balance'),
        ];
    }

    public function getProfitLoss(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfYear()->toDateString();
        $to   = $to ?? now()->toDateString();

        $totalIncome = (float) Transaction::where('type', 'income')
            ->whereBetween('date', [$from, $to])->sum('debit');
        $totalExpense = (float) Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])->sum('credit');

        return [
            'from' => $from, 'to' => $to,
            'total_revenue' => $totalIncome,
            'total_expense' => $totalExpense,
            'net_profit'    => $totalIncome - $totalExpense,
        ];
    }

    public function getBalanceSheet(?string $asOf = null): array
    {
        $accounts = Account::where('is_active', true)->orderBy('code')->get();

        $assets      = $accounts->where('type', 'asset');
        $liabilities = $accounts->where('type', 'liability');
        $equity      = $accounts->where('type', 'equity');
        $income      = $accounts->where('type', 'income');
        $expense     = $accounts->where('type', 'expense');

        $retainedEarnings = $income->sum('balance') - $expense->sum('balance');

        return [
            'as_of'             => $asOf ?? now()->toDateString(),
            'assets'            => $assets->values()->toArray(),
            'total_assets'      => (float) $assets->sum('balance'),
            'liabilities'       => $liabilities->values()->toArray(),
            'total_liabilities' => (float) $liabilities->sum('balance'),
            'equity'            => $equity->values()->toArray(),
            'total_equity'      => (float) $equity->sum('balance'),
            'retained_earnings' => (float) $retainedEarnings,
            'total_liabilities_equity' => (float) ($liabilities->sum('balance') + $equity->sum('balance') + $retainedEarnings),
        ];
    }

    public function getChartOfAccounts(): array
    {
        return Account::with('children')
            ->whereNull('parent_id')
            ->orderBy('code')
            ->get()
            ->toArray();
    }

    public function getTrialBalance(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfYear()->toDateString();
        $to   = $to ?? now()->toDateString();

        $accounts = Account::where('is_active', true)->orderBy('code')->get();

        $trialData = $accounts->map(function ($account) use ($from, $to) {
            $debits = (float) Transaction::where('account_id', $account->id)
                ->whereBetween('date', [$from, $to])->sum('debit');
            $credits = (float) Transaction::where('account_id', $account->id)
                ->whereBetween('date', [$from, $to])->sum('credit');

            return [
                'id' => $account->id, 'code' => $account->code,
                'name' => $account->name, 'type' => $account->type,
                'debit' => $debits, 'credit' => $credits,
                'balance' => (float) $account->balance,
            ];
        })->filter(fn($a) => $a['debit'] > 0 || $a['credit'] > 0 || $a['balance'] != 0)->values();

        return [
            'from' => $from, 'to' => $to,
            'accounts'     => $trialData->toArray(),
            'total_debit'  => $trialData->sum('debit'),
            'total_credit' => $trialData->sum('credit'),
        ];
    }

    public function getCashFlow(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfMonth()->toDateString();
        $to   = $to ?? now()->endOfMonth()->toDateString();

        $inflow = (float) Transaction::where('type', 'income')
            ->whereBetween('date', [$from, $to])->sum('debit');
        $outflow = (float) Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])->sum('credit');

        $cashAccounts = Account::where('is_active', true)
            ->where('type', 'asset')
            ->where('name', 'like', '%cash%')
            ->get();

        return [
            'from' => $from, 'to' => $to,
            'operating' => ['cash_inflow' => $inflow, 'cash_outflow' => $outflow, 'net' => $inflow - $outflow],
            'cash_accounts' => $cashAccounts->map(fn($a) => ['name' => $a->name, 'code' => $a->code, 'balance' => (float) $a->balance])->toArray(),
            'total_cash_balance' => (float) $cashAccounts->sum('balance'),
        ];
    }

    public function getDaybook(string $date): array
    {
        $transactions = Transaction::with(['account', 'createdBy'])
            ->whereDate('date', $date)
            ->orderBy('created_at')
            ->get();

        return [
            'date' => $date,
            'transactions' => $transactions->toArray(),
            'total_debit'  => (float) $transactions->sum('debit'),
            'total_credit' => (float) $transactions->sum('credit'),
            'count'        => $transactions->count(),
        ];
    }

    public function getLedgerStatement(string $accountId, ?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfMonth()->toDateString();
        $to   = $to ?? now()->endOfMonth()->toDateString();

        $account = Account::findOrFail($accountId);

        $openingDebit = (float) Transaction::where('account_id', $accountId)->where('date', '<', $from)->sum('debit');
        $openingCredit = (float) Transaction::where('account_id', $accountId)->where('date', '<', $from)->sum('credit');

        $openingBalance = in_array($account->type, ['asset', 'expense'])
            ? $openingDebit - $openingCredit
            : $openingCredit - $openingDebit;

        $transactions = Transaction::where('account_id', $accountId)
            ->whereBetween('date', [$from, $to])
            ->orderBy('date')->orderBy('created_at')
            ->get();

        $runningBalance = $openingBalance;
        $entries = $transactions->map(function ($txn) use (&$runningBalance, $account) {
            if (in_array($account->type, ['asset', 'expense'])) {
                $runningBalance += ($txn->debit - $txn->credit);
            } else {
                $runningBalance += ($txn->credit - $txn->debit);
            }
            return [
                'id' => $txn->id, 'date' => $txn->date?->format('Y-m-d'),
                'description' => $txn->description,
                'debit' => (float) $txn->debit, 'credit' => (float) $txn->credit,
                'balance' => round($runningBalance, 2),
            ];
        });

        return [
            'account' => $account->toArray(),
            'from' => $from, 'to' => $to,
            'opening_balance' => round($openingBalance, 2),
            'entries' => $entries->toArray(),
            'closing_balance' => round($runningBalance, 2),
            'total_debit'  => (float) $transactions->sum('debit'),
            'total_credit' => (float) $transactions->sum('credit'),
        ];
    }

    public function getReceivablePayable(): array
    {
        $receivable = Account::where('code', '1100')->first();
        $payable = Account::where('code', '2001')->first();

        return [
            'receivable' => ['balance' => $receivable ? (float) $receivable->balance : 0],
            'payable'    => ['balance' => $payable ? (float) $payable->balance : 0],
        ];
    }

    public function getEquityChanges(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfYear()->toDateString();
        $to   = $to ?? now()->toDateString();

        $equityAccounts = Account::where('type', 'equity')->where('is_active', true)->orderBy('code')->get();

        $changes = $equityAccounts->map(function ($account) use ($from, $to) {
            $debits = (float) Transaction::where('account_id', $account->id)->whereBetween('date', [$from, $to])->sum('debit');
            $credits = (float) Transaction::where('account_id', $account->id)->whereBetween('date', [$from, $to])->sum('credit');
            return [
                'id' => $account->id, 'code' => $account->code, 'name' => $account->name,
                'balance' => (float) $account->balance, 'debit' => $debits, 'credit' => $credits,
                'change' => $credits - $debits,
            ];
        });

        $retainedEarnings = Account::where('type', 'income')->where('is_active', true)->sum('balance')
            - Account::where('type', 'expense')->where('is_active', true)->sum('balance');

        return [
            'from' => $from, 'to' => $to,
            'equity_accounts' => $changes->toArray(),
            'retained_earnings' => (float) $retainedEarnings,
            'total_equity' => (float) $equityAccounts->sum('balance') + $retainedEarnings,
        ];
    }

    public function getChequeRegister(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfMonth()->toDateString();
        $to   = $to ?? now()->endOfMonth()->toDateString();

        $transactions = Transaction::with(['account'])
            ->where(function ($q) {
                $q->where('description', 'like', '%cheque%')
                  ->orWhere('description', 'like', '%check%');
            })
            ->whereBetween('date', [$from, $to])
            ->orderBy('date', 'desc')
            ->get();

        return [
            'from' => $from, 'to' => $to,
            'transactions' => $transactions->toArray(),
            'total_debit'  => (float) $transactions->sum('debit'),
            'total_credit' => (float) $transactions->sum('credit'),
            'count' => $transactions->count(),
        ];
    }

    public function getAllLedgers(): array
    {
        return Account::where('is_active', true)
            ->orderBy('type')->orderBy('code')
            ->get()
            ->map(fn($a) => [
                'id' => $a->id, 'code' => $a->code, 'name' => $a->name,
                'type' => $a->type, 'balance' => (float) $a->balance,
                'level' => $a->level, 'is_system' => $a->is_system,
            ])
            ->toArray();
    }
}

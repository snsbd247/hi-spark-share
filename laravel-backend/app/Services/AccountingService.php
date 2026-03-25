<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AccountingService
{
    /**
     * Create a double-entry journal entry.
     * Each entry debits one account and credits another.
     */
    public function createJournalEntry(array $entries, ?string $description = null, ?string $createdBy = null): string
    {
        $journalRef = 'JE-' . strtoupper(Str::random(8));
        $totalDebit = collect($entries)->sum('debit');
        $totalCredit = collect($entries)->sum('credit');

        if (abs($totalDebit - $totalCredit) > 0.01) {
            throw new \InvalidArgumentException('Debit and Credit must be equal. Debit: ' . $totalDebit . ', Credit: ' . $totalCredit);
        }

        DB::transaction(function () use ($entries, $journalRef, $description, $createdBy) {
            foreach ($entries as $entry) {
                $debit = $entry['debit'] ?? 0;
                $credit = $entry['credit'] ?? 0;
                $amount = max($debit, $credit);

                Transaction::create([
                    'type'           => $debit > 0 ? 'debit' : 'credit',
                    'category'       => $entry['category'] ?? 'journal',
                    'amount'         => $amount,
                    'debit'          => $debit,
                    'credit'         => $credit,
                    'date'           => $entry['date'] ?? now()->toDateString(),
                    'description'    => $entry['description'] ?? $description,
                    'reference_type' => $entry['reference_type'] ?? 'journal',
                    'reference_id'   => $entry['reference_id'] ?? null,
                    'account_id'     => $entry['account_id'],
                    'customer_id'    => $entry['customer_id'] ?? null,
                    'vendor_id'      => $entry['vendor_id'] ?? null,
                    'created_by'     => $createdBy,
                    'journal_ref'    => $journalRef,
                ]);

                // Update account balance
                $account = Account::find($entry['account_id']);
                if ($account) {
                    // Asset & Expense: debit increases, credit decreases
                    // Liability, Income, Equity: credit increases, debit decreases
                    if (in_array($account->type, ['asset', 'expense'])) {
                        $account->increment('balance', $debit - $credit);
                    } else {
                        $account->increment('balance', $credit - $debit);
                    }
                }
            }
        });

        return $journalRef;
    }

    /**
     * Record an income transaction (double-entry).
     */
    public function recordIncome(array $data): Transaction
    {
        return DB::transaction(function () use ($data) {
            $txn = Transaction::create([
                'type'           => 'income',
                'category'       => $data['category'],
                'amount'         => $data['amount'],
                'debit'          => $data['amount'],
                'credit'         => 0,
                'date'           => $data['date'] ?? now()->toDateString(),
                'description'    => $data['description'] ?? null,
                'reference_type' => $data['reference_type'] ?? 'manual',
                'reference_id'   => $data['reference_id'] ?? null,
                'account_id'     => $data['account_id'] ?? null,
                'customer_id'    => $data['customer_id'] ?? null,
                'vendor_id'      => $data['vendor_id'] ?? null,
                'created_by'     => $data['created_by'] ?? null,
            ]);

            if ($txn->account_id) {
                Account::where('id', $txn->account_id)->increment('balance', $txn->amount);
            }

            return $txn;
        });
    }

    /**
     * Record an expense transaction (double-entry).
     */
    public function recordExpense(array $data): Transaction
    {
        return DB::transaction(function () use ($data) {
            $txn = Transaction::create([
                'type'           => 'expense',
                'category'       => $data['category'],
                'amount'         => $data['amount'],
                'debit'          => 0,
                'credit'         => $data['amount'],
                'date'           => $data['date'] ?? now()->toDateString(),
                'description'    => $data['description'] ?? null,
                'reference_type' => $data['reference_type'] ?? 'manual',
                'reference_id'   => $data['reference_id'] ?? null,
                'account_id'     => $data['account_id'] ?? null,
                'customer_id'    => $data['customer_id'] ?? null,
                'vendor_id'      => $data['vendor_id'] ?? null,
                'created_by'     => $data['created_by'] ?? null,
            ]);

            if ($txn->account_id) {
                Account::where('id', $txn->account_id)->decrement('balance', $txn->amount);
            }

            return $txn;
        });
    }

    /**
     * Get financial summary for a date range.
     */
    public function getFinancialSummary(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfMonth()->toDateString();
        $to   = $to ?? now()->endOfMonth()->toDateString();

        $income = Transaction::where('type', 'income')
            ->whereBetween('date', [$from, $to])->sum('amount');
        $expense = Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])->sum('amount');

        $incomeByCategory = Transaction::where('type', 'income')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')->pluck('total', 'category');

        $expenseByCategory = Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')->pluck('total', 'category');

        return [
            'from' => $from, 'to' => $to,
            'total_income'        => (float) $income,
            'total_expense'       => (float) $expense,
            'net_profit'          => (float) ($income - $expense),
            'income_by_category'  => $incomeByCategory,
            'expense_by_category' => $expenseByCategory,
        ];
    }

    /**
     * Get account balances grouped by type.
     */
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

    /**
     * Get profit & loss report.
     */
    public function getProfitLoss(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfYear()->toDateString();
        $to   = $to ?? now()->toDateString();

        $billingIncome = Transaction::where('type', 'income')
            ->where('category', 'payment')
            ->whereBetween('date', [$from, $to])->sum('amount');

        $salesIncome = Transaction::where('type', 'income')
            ->where('category', 'sale')
            ->whereBetween('date', [$from, $to])->sum('amount');

        $purchaseExpense = Transaction::where('type', 'expense')
            ->where('category', 'purchase')
            ->whereBetween('date', [$from, $to])->sum('amount');

        $otherExpenses = Transaction::where('type', 'expense')
            ->whereNotIn('category', ['purchase'])
            ->whereBetween('date', [$from, $to])->sum('amount');

        $totalRevenue = $billingIncome + $salesIncome;
        $grossProfit  = $salesIncome - $purchaseExpense;
        $netProfit    = $totalRevenue - $purchaseExpense - $otherExpenses;

        return [
            'from' => $from, 'to' => $to,
            'billing_income' => (float) $billingIncome,
            'sales_income'   => (float) $salesIncome,
            'total_revenue'  => (float) $totalRevenue,
            'cost_of_goods'  => (float) $purchaseExpense,
            'gross_profit'   => (float) $grossProfit,
            'other_expenses' => (float) $otherExpenses,
            'net_profit'     => (float) $netProfit,
        ];
    }

    /**
     * Get Balance Sheet report.
     */
    public function getBalanceSheet(?string $asOf = null): array
    {
        $asOf = $asOf ?? now()->toDateString();

        $accounts = Account::where('is_active', true)->orderBy('code')->get();

        $assets      = $accounts->where('type', 'asset');
        $liabilities = $accounts->where('type', 'liability');
        $equity      = $accounts->where('type', 'equity');
        $income      = $accounts->where('type', 'income');
        $expense     = $accounts->where('type', 'expense');

        $totalAssets      = $assets->sum('balance');
        $totalLiabilities = $liabilities->sum('balance');
        $totalEquity      = $equity->sum('balance');
        $retainedEarnings = $income->sum('balance') - $expense->sum('balance');

        return [
            'as_of'             => $asOf,
            'assets'            => $assets->values()->toArray(),
            'total_assets'      => (float) $totalAssets,
            'liabilities'       => $liabilities->values()->toArray(),
            'total_liabilities' => (float) $totalLiabilities,
            'equity'            => $equity->values()->toArray(),
            'total_equity'      => (float) $totalEquity,
            'retained_earnings' => (float) $retainedEarnings,
            'total_liabilities_equity' => (float) ($totalLiabilities + $totalEquity + $retainedEarnings),
        ];
    }

    /**
     * Get Chart of Accounts as tree.
     */
    public function getChartOfAccounts(): array
    {
        $accounts = Account::with('allChildren')
            ->whereNull('parent_id')
            ->orderBy('code')
            ->get();

        return $accounts->toArray();
    }
}

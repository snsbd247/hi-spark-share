<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    /**
     * Record an income transaction.
     */
    public function recordIncome(array $data): Transaction
    {
        return DB::transaction(function () use ($data) {
            $txn = Transaction::create([
                'type'           => 'income',
                'category'       => $data['category'],
                'amount'         => $data['amount'],
                'date'           => $data['date'] ?? now()->toDateString(),
                'description'    => $data['description'] ?? null,
                'reference_type' => $data['reference_type'] ?? 'manual',
                'reference_id'   => $data['reference_id'] ?? null,
                'account_id'     => $data['account_id'] ?? null,
                'customer_id'    => $data['customer_id'] ?? null,
                'vendor_id'      => $data['vendor_id'] ?? null,
                'created_by'     => $data['created_by'] ?? null,
            ]);

            // Update account balance
            if ($txn->account_id) {
                Account::where('id', $txn->account_id)
                    ->increment('balance', $txn->amount);
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
            $txn = Transaction::create([
                'type'           => 'expense',
                'category'       => $data['category'],
                'amount'         => $data['amount'],
                'date'           => $data['date'] ?? now()->toDateString(),
                'description'    => $data['description'] ?? null,
                'reference_type' => $data['reference_type'] ?? 'manual',
                'reference_id'   => $data['reference_id'] ?? null,
                'account_id'     => $data['account_id'] ?? null,
                'customer_id'    => $data['customer_id'] ?? null,
                'vendor_id'      => $data['vendor_id'] ?? null,
                'created_by'     => $data['created_by'] ?? null,
            ]);

            // Update account balance
            if ($txn->account_id) {
                Account::where('id', $txn->account_id)
                    ->decrement('balance', $txn->amount);
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
            ->whereBetween('date', [$from, $to])
            ->sum('amount');

        $expense = Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])
            ->sum('amount');

        $incomeByCategory = Transaction::where('type', 'income')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $expenseByCategory = Transaction::where('type', 'expense')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        return [
            'from'                => $from,
            'to'                  => $to,
            'total_income'        => (float) $income,
            'total_expense'       => (float) $expense,
            'net_profit'          => (float) ($income - $expense),
            'income_by_category'  => $incomeByCategory,
            'expense_by_category' => $expenseByCategory,
        ];
    }

    /**
     * Get account balances.
     */
    public function getAccountBalances(): array
    {
        $accounts = Account::where('is_active', true)
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        $grouped = $accounts->groupBy('type')->map(function ($group) {
            return [
                'accounts'      => $group->toArray(),
                'total_balance' => $group->sum('balance'),
            ];
        });

        return [
            'accounts' => $grouped,
            'total_assets'      => (float) $accounts->where('type', 'asset')->sum('balance'),
            'total_liabilities' => (float) $accounts->where('type', 'liability')->sum('balance'),
            'total_income'      => (float) $accounts->where('type', 'income')->sum('balance'),
            'total_expense'     => (float) $accounts->where('type', 'expense')->sum('balance'),
        ];
    }

    /**
     * Get profit & loss report.
     */
    public function getProfitLoss(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfYear()->toDateString();
        $to   = $to ?? now()->toDateString();

        // Revenue from ISP billing payments
        $billingIncome = Transaction::where('type', 'income')
            ->where('category', 'payment')
            ->whereBetween('date', [$from, $to])
            ->sum('amount');

        // Revenue from product sales
        $salesIncome = Transaction::where('type', 'income')
            ->where('category', 'sale')
            ->whereBetween('date', [$from, $to])
            ->sum('amount');

        // Cost of goods sold (purchases)
        $purchaseExpense = Transaction::where('type', 'expense')
            ->where('category', 'purchase')
            ->whereBetween('date', [$from, $to])
            ->sum('amount');

        // Other expenses
        $otherExpenses = Transaction::where('type', 'expense')
            ->whereNotIn('category', ['purchase'])
            ->whereBetween('date', [$from, $to])
            ->sum('amount');

        $totalRevenue = $billingIncome + $salesIncome;
        $grossProfit  = $salesIncome - $purchaseExpense;
        $netProfit    = $totalRevenue - $purchaseExpense - $otherExpenses;

        return [
            'from'              => $from,
            'to'                => $to,
            'billing_income'    => (float) $billingIncome,
            'sales_income'      => (float) $salesIncome,
            'total_revenue'     => (float) $totalRevenue,
            'cost_of_goods'     => (float) $purchaseExpense,
            'gross_profit'      => (float) $grossProfit,
            'other_expenses'    => (float) $otherExpenses,
            'net_profit'        => (float) $netProfit,
        ];
    }
}

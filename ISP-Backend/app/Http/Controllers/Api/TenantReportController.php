<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SmsLog;
use App\Models\Supplier;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Financial reports scoped to a specific tenant.
 * Used by Super Admin to view tenant-level financial data.
 */
class TenantReportController extends Controller
{
    // ── Overview ────────────────────────────────────────────
    public function overview(string $tenantId)
    {
        $currentMonth = now()->format('Y-m');

        $totalCustomers  = Customer::where('tenant_id', $tenantId)->count();
        $activeCustomers = Customer::where('tenant_id', $tenantId)->where('status', 'active')->count();
        $inactiveCustomers = Customer::where('tenant_id', $tenantId)->where('status', 'inactive')->count();

        $totalRevenue = (float) Payment::where('tenant_id', $tenantId)->where('status', 'completed')->sum('amount');
        $monthlyRevenue = (float) Payment::where('tenant_id', $tenantId)->where('status', 'completed')
            ->whereMonth('paid_at', now()->month)->whereYear('paid_at', now()->year)->sum('amount');

        $totalExpense = (float) Expense::where('tenant_id', $tenantId)->where('status', 'active')->sum('amount');
        $monthlyExpense = (float) Expense::where('tenant_id', $tenantId)->where('status', 'active')
            ->whereMonth('date', now()->month)->whereYear('date', now()->year)->sum('amount');

        $totalBilled = (float) Bill::where('tenant_id', $tenantId)->where('month', $currentMonth)->sum('amount');
        $totalCollected = (float) Bill::where('tenant_id', $tenantId)->where('month', $currentMonth)->where('status', 'paid')->sum('amount');
        $totalDue = (float) Bill::where('tenant_id', $tenantId)->where('status', 'unpaid')->sum('amount');

        $arpu = $activeCustomers > 0 ? round($monthlyRevenue / $activeCustomers, 2) : 0;
        $churnCount = $inactiveCustomers;
        $churnRate = $totalCustomers > 0 ? round(($churnCount / $totalCustomers) * 100, 1) : 0;
        $collectionRate = $totalBilled > 0 ? round(($totalCollected / $totalBilled) * 100, 1) : 0;

        $totalSms = (int) SmsLog::where('tenant_id', $tenantId)->count();
        $monthlySms = (int) SmsLog::where('tenant_id', $tenantId)
            ->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->count();

        $inventoryValue = (float) Product::where('tenant_id', $tenantId)
            ->selectRaw('COALESCE(SUM(stock * buy_price), 0) as value')->value('value');

        return response()->json([
            'total_customers'   => $totalCustomers,
            'active_customers'  => $activeCustomers,
            'inactive_customers'=> $inactiveCustomers,
            'total_revenue'     => $totalRevenue,
            'monthly_revenue'   => $monthlyRevenue,
            'total_expense'     => $totalExpense,
            'monthly_expense'   => $monthlyExpense,
            'net_profit'        => $totalRevenue - $totalExpense,
            'monthly_profit'    => $monthlyRevenue - $monthlyExpense,
            'total_billed'      => $totalBilled,
            'total_collected'   => $totalCollected,
            'total_due'         => $totalDue,
            'collection_rate'   => $collectionRate,
            'arpu'              => $arpu,
            'churn_count'       => $churnCount,
            'churn_rate'        => $churnRate,
            'total_sms'         => $totalSms,
            'monthly_sms'       => $monthlySms,
            'inventory_value'   => $inventoryValue,
        ]);
    }

    // ── Revenue ────────────────────────────────────────────
    public function revenue(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->subDays(30)->toDateString());
        $to   = $request->get('to', now()->toDateString());

        $daily = Payment::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('DATE(paid_at) as date, SUM(amount) as total, COUNT(*) as count')
            ->groupByRaw('DATE(paid_at)')->orderBy('date')->get();

        $byMethod = Payment::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('payment_method, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('payment_method')->get();

        return response()->json([
            'from' => $from, 'to' => $to,
            'daily' => $daily, 'by_method' => $byMethod,
            'total' => (float) $daily->sum('total'),
        ]);
    }

    // ── Expense ────────────────────────────────────────────
    public function expense(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->endOfMonth()->toDateString());

        $byCategory = Expense::where('tenant_id', $tenantId)->where('status', 'active')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')->orderBy('total', 'desc')->get();

        $daily = Expense::where('tenant_id', $tenantId)->where('status', 'active')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('DATE(date) as date, SUM(amount) as total')
            ->groupByRaw('DATE(date)')->orderBy('date')->get();

        return response()->json([
            'from' => $from, 'to' => $to,
            'by_category' => $byCategory, 'daily' => $daily,
            'total' => (float) $byCategory->sum('total'),
        ]);
    }

    // ── Profit & Loss ──────────────────────────────────────
    public function profitLoss(string $tenantId, Request $request)
    {
        $year = $request->get('year', now()->year);
        $months = [];

        for ($m = 1; $m <= 12; $m++) {
            $revenue = (float) Payment::where('tenant_id', $tenantId)->where('status', 'completed')
                ->whereMonth('paid_at', $m)->whereYear('paid_at', $year)->sum('amount');
            $expense = (float) Expense::where('tenant_id', $tenantId)->where('status', 'active')
                ->whereMonth('date', $m)->whereYear('date', $year)->sum('amount');

            $months[] = [
                'month' => date('M', mktime(0, 0, 0, $m, 1)),
                'month_num' => $m,
                'revenue' => $revenue, 'expense' => $expense,
                'profit' => $revenue - $expense,
            ];
        }

        return response()->json([
            'year' => (int) $year, 'months' => $months,
            'yearly' => [
                'revenue' => collect($months)->sum('revenue'),
                'expense' => collect($months)->sum('expense'),
                'profit'  => collect($months)->sum('profit'),
            ],
        ]);
    }

    // ── Invoices ───────────────────────────────────────────
    public function invoices(string $tenantId, Request $request)
    {
        $month = $request->get('month', now()->format('Y-m'));

        $summary = Bill::where('tenant_id', $tenantId)->where('month', $month)
            ->selectRaw("status, COUNT(*) as count, SUM(amount) as total")
            ->groupBy('status')->get();

        $recentBills = Bill::where('tenant_id', $tenantId)
            ->with('customer:id,name,customer_id,phone')
            ->orderBy('created_at', 'desc')->limit(20)->get();

        return response()->json(['month' => $month, 'summary' => $summary, 'recent' => $recentBills]);
    }

    // ── Payments ───────────────────────────────────────────
    public function payments(string $tenantId)
    {
        return response()->json(
            Payment::where('tenant_id', $tenantId)
                ->with('customer:id,name,customer_id,phone')
                ->orderBy('created_at', 'desc')->limit(50)->get()
        );
    }

    // ── Customers ──────────────────────────────────────────
    public function customers(string $tenantId)
    {
        $byStatus = Customer::where('tenant_id', $tenantId)
            ->selectRaw("status, COUNT(*) as count")->groupBy('status')->get();

        $byArea = Customer::where('tenant_id', $tenantId)
            ->selectRaw("area, COUNT(*) as count")->groupBy('area')
            ->orderBy('count', 'desc')->limit(10)->get();

        $monthlyGrowth = Customer::where('tenant_id', $tenantId)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->orderBy('month', 'desc')->limit(12)->get();

        return response()->json([
            'by_status' => $byStatus, 'by_area' => $byArea,
            'monthly_growth' => $monthlyGrowth,
            'total' => Customer::where('tenant_id', $tenantId)->count(),
        ]);
    }

    // ── SMS ────────────────────────────────────────────────
    public function sms(string $tenantId)
    {
        $monthlySms = SmsLog::where('tenant_id', $tenantId)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count, SUM(sms_count) as sms_total")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->orderBy('month', 'desc')->limit(12)->get();

        $byType = SmsLog::where('tenant_id', $tenantId)
            ->selectRaw("sms_type, COUNT(*) as count")->groupBy('sms_type')->get();

        return response()->json([
            'monthly' => $monthlySms, 'by_type' => $byType,
            'total' => (int) SmsLog::where('tenant_id', $tenantId)->count(),
        ]);
    }

    // ── General Ledger ─────────────────────────────────────
    public function ledger(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->endOfMonth()->toDateString());

        $transactions = Transaction::where('tenant_id', $tenantId)
            ->whereBetween('date', [$from, $to])
            ->with('account:id,name,code,type')
            ->orderBy('date', 'desc')->orderBy('created_at', 'desc')
            ->limit(200)->get();

        return response()->json([
            'from' => $from, 'to' => $to,
            'transactions' => $transactions,
            'total_debit' => (float) $transactions->sum('debit'),
            'total_credit' => (float) $transactions->sum('credit'),
        ]);
    }

    // ── Trial Balance ──────────────────────────────────────
    public function trialBalance(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->startOfYear()->toDateString());
        $to   = $request->get('to', now()->toDateString());

        $accounts = Account::where('tenant_id', $tenantId)
            ->where('is_active', true)->orderBy('code')->get();

        $result = [];
        $totalDebit = 0;
        $totalCredit = 0;

        foreach ($accounts as $account) {
            $debit = (float) Transaction::where('tenant_id', $tenantId)
                ->where('account_id', $account->id)
                ->whereBetween('date', [$from, $to])->sum('debit');
            $credit = (float) Transaction::where('tenant_id', $tenantId)
                ->where('account_id', $account->id)
                ->whereBetween('date', [$from, $to])->sum('credit');

            if ($debit > 0 || $credit > 0) {
                $net = $debit - $credit;
                $result[] = [
                    'account_id'   => $account->id,
                    'account_name' => $account->name,
                    'account_code' => $account->code,
                    'account_type' => $account->type,
                    'debit'        => $net > 0 ? $net : 0,
                    'credit'       => $net < 0 ? abs($net) : 0,
                ];
                $totalDebit += $net > 0 ? $net : 0;
                $totalCredit += $net < 0 ? abs($net) : 0;
            }
        }

        return response()->json([
            'from' => $from, 'to' => $to,
            'accounts' => $result,
            'total_debit' => round($totalDebit, 2),
            'total_credit' => round($totalCredit, 2),
            'is_balanced' => abs($totalDebit - $totalCredit) < 0.01,
        ]);
    }

    // ── Balance Sheet ──────────────────────────────────────
    public function balanceSheet(string $tenantId)
    {
        $accounts = Account::where('tenant_id', $tenantId)
            ->where('is_active', true)->orderBy('code')->get();

        $assets = []; $liabilities = []; $equity = [];
        $totalAssets = 0; $totalLiabilities = 0; $totalEquity = 0;

        foreach ($accounts as $a) {
            $entry = [
                'id' => $a->id, 'name' => $a->name, 'code' => $a->code,
                'balance' => (float) $a->balance,
            ];

            if ($a->type === 'asset') {
                $assets[] = $entry;
                $totalAssets += $entry['balance'];
            } elseif ($a->type === 'liability') {
                $liabilities[] = $entry;
                $totalLiabilities += $entry['balance'];
            } elseif ($a->type === 'equity') {
                $equity[] = $entry;
                $totalEquity += $entry['balance'];
            }
        }

        // Add retained earnings (income - expense)
        $totalIncome  = (float) Account::where('tenant_id', $tenantId)->where('type', 'income')->sum('balance');
        $totalExpense = (float) Account::where('tenant_id', $tenantId)->where('type', 'expense')->sum('balance');
        $retainedEarnings = $totalIncome - $totalExpense;

        $equity[] = ['id' => 'retained', 'name' => 'Retained Earnings', 'code' => 'RE', 'balance' => $retainedEarnings];
        $totalEquity += $retainedEarnings;

        return response()->json([
            'as_of'            => now()->toDateString(),
            'assets'           => $assets,
            'liabilities'      => $liabilities,
            'equity'           => $equity,
            'total_assets'     => round($totalAssets, 2),
            'total_liabilities'=> round($totalLiabilities, 2),
            'total_equity'     => round($totalEquity, 2),
            'is_balanced'      => abs($totalAssets - ($totalLiabilities + $totalEquity)) < 0.01,
        ]);
    }

    // ── Account Balances ───────────────────────────────────
    public function accountBalances(string $tenantId)
    {
        $accounts = Account::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('type')->orderBy('code')
            ->get(['id', 'name', 'code', 'type', 'balance']);

        $grouped = $accounts->groupBy('type')->map(function ($group) {
            return [
                'accounts' => $group->values(),
                'total'    => round($group->sum('balance'), 2),
            ];
        });

        return response()->json($grouped);
    }

    // ── Receivable & Payable ───────────────────────────────
    public function receivablePayable(string $tenantId)
    {
        // Customer Receivable = unpaid bills
        $receivables = Bill::where('tenant_id', $tenantId)
            ->where('status', 'unpaid')
            ->with('customer:id,name,customer_id,phone,area')
            ->selectRaw('customer_id, SUM(amount - paid_amount) as due_amount, COUNT(*) as bill_count')
            ->groupBy('customer_id')
            ->having('due_amount', '>', 0)
            ->orderBy('due_amount', 'desc')
            ->limit(50)->get();

        $totalReceivable = (float) Bill::where('tenant_id', $tenantId)
            ->where('status', 'unpaid')
            ->selectRaw('SUM(amount - paid_amount) as total')->value('total') ?? 0;

        // Supplier Payable
        $payables = [];
        $totalPayable = 0;
        if (class_exists(Supplier::class)) {
            $payables = Supplier::where('tenant_id', $tenantId)
                ->where('total_due', '>', 0)
                ->orderBy('total_due', 'desc')
                ->get(['id', 'name', 'phone', 'company', 'total_due']);
            $totalPayable = (float) $payables->sum('total_due');
        }

        return response()->json([
            'receivables'      => $receivables,
            'total_receivable' => round($totalReceivable, 2),
            'payables'         => $payables,
            'total_payable'    => round($totalPayable, 2),
            'net_position'     => round($totalReceivable - $totalPayable, 2),
        ]);
    }

    // ── Inventory Report ───────────────────────────────────
    public function inventory(string $tenantId)
    {
        $products = Product::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name', 'sku', 'stock', 'buy_price', 'sell_price']);

        $totalValue = $products->sum(fn ($p) => $p->stock * $p->buy_price);
        $lowStock = $products->filter(fn ($p) => $p->stock <= 5 && $p->stock > 0);
        $outOfStock = $products->filter(fn ($p) => $p->stock <= 0);

        return response()->json([
            'products'      => $products,
            'total_products'=> $products->count(),
            'total_value'   => round($totalValue, 2),
            'low_stock'     => $lowStock->values(),
            'out_of_stock'  => $outOfStock->values(),
        ]);
    }

    // ── Cash Flow ──────────────────────────────────────────
    public function cashFlow(string $tenantId, Request $request)
    {
        $year = $request->get('year', now()->year);
        $months = [];

        for ($m = 1; $m <= 12; $m++) {
            $inflow = (float) Payment::where('tenant_id', $tenantId)->where('status', 'completed')
                ->whereMonth('paid_at', $m)->whereYear('paid_at', $year)->sum('amount');

            $outflow = (float) Expense::where('tenant_id', $tenantId)->where('status', 'active')
                ->whereMonth('date', $m)->whereYear('date', $year)->sum('amount');

            $months[] = [
                'month' => date('M', mktime(0, 0, 0, $m, 1)),
                'inflow' => $inflow,
                'outflow' => $outflow,
                'net' => $inflow - $outflow,
            ];
        }

        return response()->json([
            'year' => (int) $year,
            'months' => $months,
            'yearly' => [
                'inflow'  => collect($months)->sum('inflow'),
                'outflow' => collect($months)->sum('outflow'),
                'net'     => collect($months)->sum('net'),
            ],
        ]);
    }
}

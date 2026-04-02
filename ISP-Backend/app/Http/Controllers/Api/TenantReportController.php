<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SmsLog;
use App\Models\Transaction;
use Illuminate\Http\Request;

/**
 * Financial reports scoped to a specific tenant.
 * Used by Super Admin to view tenant-level financial data.
 */
class TenantReportController extends Controller
{
    /**
     * GET /super-admin/tenants/{id}/reports/overview
     * Dashboard-level financial overview for a specific tenant.
     */
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
        $churnCount = Customer::where('tenant_id', $tenantId)->where('status', 'inactive')->count();
        $churnRate = $totalCustomers > 0 ? round(($churnCount / $totalCustomers) * 100, 1) : 0;
        $collectionRate = $totalBilled > 0 ? round(($totalCollected / $totalBilled) * 100, 1) : 0;

        // SMS stats
        $totalSms = (int) SmsLog::where('tenant_id', $tenantId)->count();
        $monthlySms = (int) SmsLog::where('tenant_id', $tenantId)
            ->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->count();

        // Inventory value
        $inventoryValue = (float) Product::selectRaw('COALESCE(SUM(stock * buy_price), 0) as value')->value('value');

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

    /**
     * GET /super-admin/tenants/{id}/reports/revenue
     * Daily revenue breakdown.
     */
    public function revenue(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->subDays(30)->toDateString());
        $to   = $request->get('to', now()->toDateString());

        $daily = Payment::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('DATE(paid_at) as date, SUM(amount) as total, COUNT(*) as count')
            ->groupByRaw('DATE(paid_at)')
            ->orderBy('date')
            ->get();

        $byMethod = Payment::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('payment_method, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('payment_method')
            ->get();

        return response()->json([
            'from'      => $from,
            'to'        => $to,
            'daily'     => $daily,
            'by_method' => $byMethod,
            'total'     => (float) $daily->sum('total'),
        ]);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/expense
     * Expense breakdown by category.
     */
    public function expense(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->endOfMonth()->toDateString());

        $byCategory = Expense::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')
            ->orderBy('total', 'desc')
            ->get();

        $daily = Expense::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('DATE(date) as date, SUM(amount) as total')
            ->groupByRaw('DATE(date)')
            ->orderBy('date')
            ->get();

        return response()->json([
            'from'        => $from,
            'to'          => $to,
            'by_category' => $byCategory,
            'daily'       => $daily,
            'total'       => (float) $byCategory->sum('total'),
        ]);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/profit-loss
     * Monthly P&L for the year.
     */
    public function profitLoss(string $tenantId, Request $request)
    {
        $year = $request->get('year', now()->year);
        $months = [];

        for ($m = 1; $m <= 12; $m++) {
            $revenue = (float) Payment::where('tenant_id', $tenantId)
                ->where('status', 'completed')
                ->whereMonth('paid_at', $m)->whereYear('paid_at', $year)
                ->sum('amount');

            $expense = (float) Expense::where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->whereMonth('date', $m)->whereYear('date', $year)
                ->sum('amount');

            $months[] = [
                'month'   => date('M', mktime(0, 0, 0, $m, 1)),
                'month_num' => $m,
                'revenue' => $revenue,
                'expense' => $expense,
                'profit'  => $revenue - $expense,
            ];
        }

        return response()->json([
            'year'   => (int) $year,
            'months' => $months,
            'yearly' => [
                'revenue' => collect($months)->sum('revenue'),
                'expense' => collect($months)->sum('expense'),
                'profit'  => collect($months)->sum('profit'),
            ],
        ]);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/invoices
     * Invoice/Bill summary.
     */
    public function invoices(string $tenantId, Request $request)
    {
        $month = $request->get('month', now()->format('Y-m'));

        $summary = Bill::where('tenant_id', $tenantId)
            ->where('month', $month)
            ->selectRaw("status, COUNT(*) as count, SUM(amount) as total")
            ->groupBy('status')
            ->get();

        $recentBills = Bill::where('tenant_id', $tenantId)
            ->with('customer:id,name,customer_id,phone')
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'month'   => $month,
            'summary' => $summary,
            'recent'  => $recentBills,
        ]);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/payments
     * Recent payments list.
     */
    public function payments(string $tenantId)
    {
        $payments = Payment::where('tenant_id', $tenantId)
            ->with('customer:id,name,customer_id,phone')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($payments);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/customers
     * Customer analytics.
     */
    public function customers(string $tenantId)
    {
        $byStatus = Customer::where('tenant_id', $tenantId)
            ->selectRaw("status, COUNT(*) as count")
            ->groupBy('status')
            ->get();

        $byArea = Customer::where('tenant_id', $tenantId)
            ->selectRaw("area, COUNT(*) as count")
            ->groupBy('area')
            ->orderBy('count', 'desc')
            ->limit(10)
            ->get();

        $monthlyGrowth = Customer::where('tenant_id', $tenantId)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->orderBy('month', 'desc')
            ->limit(12)
            ->get();

        return response()->json([
            'by_status'      => $byStatus,
            'by_area'        => $byArea,
            'monthly_growth' => $monthlyGrowth,
            'total'          => Customer::where('tenant_id', $tenantId)->count(),
        ]);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/sms
     * SMS usage stats.
     */
    public function sms(string $tenantId)
    {
        $monthlySms = SmsLog::where('tenant_id', $tenantId)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count, SUM(sms_count) as sms_total")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->orderBy('month', 'desc')
            ->limit(12)
            ->get();

        $byType = SmsLog::where('tenant_id', $tenantId)
            ->selectRaw("sms_type, COUNT(*) as count")
            ->groupBy('sms_type')
            ->get();

        return response()->json([
            'monthly'  => $monthlySms,
            'by_type'  => $byType,
            'total'    => (int) SmsLog::where('tenant_id', $tenantId)->count(),
        ]);
    }

    /**
     * GET /super-admin/tenants/{id}/reports/ledger
     * Basic general ledger (transactions).
     */
    public function ledger(string $tenantId, Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->endOfMonth()->toDateString());

        $transactions = Transaction::where('tenant_id', $tenantId)
            ->whereBetween('date', [$from, $to])
            ->with('account:id,name,code,type')
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json([
            'from'         => $from,
            'to'           => $to,
            'transactions' => $transactions,
            'total_debit'  => (float) $transactions->sum('debit'),
            'total_credit' => (float) $transactions->sum('credit'),
        ]);
    }
}

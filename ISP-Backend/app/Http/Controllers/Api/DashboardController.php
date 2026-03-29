<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\MerchantPayment;
use App\Models\MikrotikRouter;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats()
    {
        $currentMonth = now()->format('Y-m');
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        // ── Customer Stats ──────────────────────────────
        $totalCustomers = Customer::count();
        $activeCustomers = Customer::where('status', 'active')->count();
        $suspendedCustomers = Customer::where('status', 'suspended')->count();
        $inactiveCustomers = Customer::where('status', 'inactive')->count();
        $onlineCustomers = Customer::where('connection_status', 'online')->count();
        $offlineCustomers = Customer::where('connection_status', 'offline')->count();

        $newCustomersMonth = Customer::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        // ── Billing Stats ───────────────────────────────
        $totalBills = Bill::where('month', $currentMonth)->count();
        $paidBills = Bill::where('month', $currentMonth)->where('status', 'paid')->count();
        $unpaidBills = Bill::where('month', $currentMonth)->where('status', 'unpaid')->count();
        $overdueBills = Bill::where('month', $currentMonth)
            ->where('status', 'unpaid')
            ->where('due_date', '<', $today)
            ->count();

        $totalBilled = (float) Bill::where('month', $currentMonth)->sum('amount');
        $totalCollection = (float) Bill::where('month', $currentMonth)
            ->where('status', 'paid')
            ->sum('amount');
        $totalDue = (float) Bill::where('month', $currentMonth)
            ->where('status', 'unpaid')
            ->sum('amount');

        // ── Payment Stats ───────────────────────────────
        $todayCollection = (float) Payment::where('status', 'completed')
            ->whereDate('paid_at', $today)
            ->sum('amount');

        $monthCollection = (float) Payment::where('status', 'completed')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount');

        $paymentByMethod = Payment::where('status', 'completed')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->selectRaw('payment_method, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('payment_method')
            ->get();

        // ── Merchant Payment Stats ──────────────────────
        $merchantTotal = (float) MerchantPayment::whereDate('payment_date', '>=', $monthStart)
            ->whereDate('payment_date', '<=', $monthEnd)
            ->sum('amount');
        $merchantMatched = (float) MerchantPayment::where('status', 'matched')
            ->whereDate('payment_date', '>=', $monthStart)
            ->whereDate('payment_date', '<=', $monthEnd)
            ->sum('amount');
        $merchantUnmatched = MerchantPayment::where('status', 'unmatched')
            ->count();

        // ── Router Stats ────────────────────────────────
        $totalRouters = MikrotikRouter::count();
        $activeRouters = MikrotikRouter::where('status', 'active')->count();

        // ── Sales & Purchase Stats ──────────────────────
        $totalSales = (float) Sale::whereBetween('sale_date', [$monthStart, $monthEnd])
            ->where('status', '!=', 'cancelled')
            ->sum('total');
        $totalPurchases = (float) Purchase::whereBetween('date', [$monthStart, $monthEnd])
            ->sum('total_amount');

        // ── Sales Profit ────────────────────────────────
        $salesProfit = 0;
        $saleItems = SaleItem::with('product')
            ->whereHas('sale', function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('sale_date', [$monthStart, $monthEnd])
                  ->where('status', '!=', 'cancelled');
            })->get();
        foreach ($saleItems as $item) {
            if ($item->product) {
                $salesProfit += ($item->unit_price - ($item->product->buy_price ?? 0)) * $item->quantity;
            }
        }

        // ── Expense Stats ───────────────────────────────
        $totalExpenses = (float) Expense::where('status', 'active')
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->sum('amount');

        // ── Low Stock ───────────────────────────────────
        $lowStockCount = Product::where('status', 'active')
            ->where('stock', '<=', 5)
            ->count();

        // ── Collection Target ───────────────────────────
        $collectionTarget = $totalBilled > 0 ? round(($totalCollection / $totalBilled) * 100, 1) : 0;

        // ── Revenue Trend (last 6 months) ───────────────
        $revenueTrend = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = now()->subMonths($i);
            $month = $m->format('Y-m');
            $label = $m->format('M Y');

            $collection = (float) Payment::where('status', 'completed')
                ->whereMonth('paid_at', $m->month)
                ->whereYear('paid_at', $m->year)
                ->sum('amount');
            $billed = (float) Bill::where('month', $month)->sum('amount');

            $mStart = $m->copy()->startOfMonth()->toDateString();
            $mEnd = $m->copy()->endOfMonth()->toDateString();

            $monthSales = (float) Sale::whereBetween('sale_date', [$mStart, $mEnd])
                ->where('status', '!=', 'cancelled')
                ->sum('total');
            $monthExpenses = (float) Expense::where('status', 'active')
                ->whereBetween('date', [$mStart, $mEnd])
                ->sum('amount');
            $monthPurchases = (float) Purchase::whereBetween('date', [$mStart, $mEnd])
                ->sum('total_amount');

            $revenueTrend[] = [
                'month' => $label,
                'collection' => $collection,
                'billed' => $billed,
                'income' => $collection + $monthSales,
                'expense' => $monthExpenses + $monthPurchases,
            ];
        }

        // ── Income vs Expense (last 6 months) ───────────
        $incomeExpenseTrend = collect($revenueTrend)->map(fn($r) => [
            'month' => $r['month'],
            'income' => $r['income'],
            'expense' => $r['expense'],
        ])->values();

        return response()->json([
            'total_customers' => $totalCustomers,
            'active_customers' => $activeCustomers,
            'suspended_customers' => $suspendedCustomers,
            'inactive_customers' => $inactiveCustomers,
            'online_customers' => $onlineCustomers,
            'offline_customers' => $offlineCustomers,
            'new_customers_month' => $newCustomersMonth,
            'total_bills' => $totalBills,
            'paid_bills' => $paidBills,
            'unpaid_bills' => $unpaidBills,
            'overdue_bills' => $overdueBills,
            'total_billed' => $totalBilled,
            'total_collection' => $totalCollection,
            'total_due' => $totalDue,
            'collection_target' => $collectionTarget,
            'today_collection' => $todayCollection,
            'month_collection' => $monthCollection,
            'payment_by_method' => $paymentByMethod,
            'merchant_total' => $merchantTotal,
            'merchant_matched' => $merchantMatched,
            'merchant_unmatched' => $merchantUnmatched,
            'total_routers' => $totalRouters,
            'active_routers' => $activeRouters,
            'total_sales' => $totalSales,
            'total_purchases' => $totalPurchases,
            'sales_profit' => (float) $salesProfit,
            'total_expenses' => $totalExpenses,
            'low_stock_count' => $lowStockCount,
            'revenue_trend' => $revenueTrend,
            'income_expense_trend' => $incomeExpenseTrend,
            'current_month' => $currentMonth,
        ]);
    }
}

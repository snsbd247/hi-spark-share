<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\DailyReport;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Transaction;
use App\Models\Vendor;
use App\Services\AccountingService;
use App\Services\InventoryService;
use App\Services\SalesService;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        protected AccountingService $accountingService,
        protected SalesService      $salesService,
        protected InventoryService  $inventoryService
    ) {}

    /**
     * GET /api/reports/dashboard
     * Combined dashboard with ISP + Accounting overview.
     */
    public function dashboard(Request $request)
    {
        $currentMonth = now()->format('Y-m');
        $monthStart   = now()->startOfMonth()->toDateString();
        $monthEnd     = now()->endOfMonth()->toDateString();

        // ISP Stats
        $totalCustomers   = Customer::count();
        $activeCustomers  = Customer::where('status', 'active')->count();
        $suspendedCustomers = Customer::where('status', 'suspended')->count();

        $billsPaid   = Bill::where('month', $currentMonth)->where('status', 'paid')->count();
        $billsUnpaid = Bill::where('month', $currentMonth)->where('status', 'unpaid')->count();
        $billingCollection = (float) Payment::where('status', 'completed')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount');
        $totalDue = (float) Bill::where('month', $currentMonth)->where('status', 'unpaid')->sum('amount');

        // Sales Stats
        $totalSales   = Sale::whereBetween('sale_date', [$monthStart, $monthEnd])->where('status', '!=', 'cancelled')->count();
        $salesRevenue = (float) Sale::whereBetween('sale_date', [$monthStart, $monthEnd])->where('status', '!=', 'cancelled')->sum('total');
        $salesProfit  = (float) SaleItem::whereHas('sale', function ($q) use ($monthStart, $monthEnd) {
            $q->whereBetween('sale_date', [$monthStart, $monthEnd])->where('status', '!=', 'cancelled');
        })->sum('profit');

        // Purchase Stats
        $totalPurchases  = Purchase::whereBetween('purchase_date', [$monthStart, $monthEnd])->count();
        $purchaseAmount  = (float) Purchase::whereBetween('purchase_date', [$monthStart, $monthEnd])->sum('total');

        // Expense Stats
        $totalExpenses = (float) Expense::where('status', 'approved')
            ->whereBetween('expense_date', [$monthStart, $monthEnd])
            ->sum('amount');

        // Inventory
        $stockSummary = $this->inventoryService->getStockSummary();

        // Net Profit
        $totalIncome = $billingCollection + $salesRevenue;
        $netProfit   = $totalIncome - $purchaseAmount - $totalExpenses;

        return response()->json([
            // ISP
            'total_customers'     => $totalCustomers,
            'active_customers'    => $activeCustomers,
            'suspended_customers' => $suspendedCustomers,
            'bills_paid'          => $billsPaid,
            'bills_unpaid'        => $billsUnpaid,
            'billing_collection'  => $billingCollection,
            'total_due'           => $totalDue,
            // Sales
            'total_sales'         => $totalSales,
            'sales_revenue'       => $salesRevenue,
            'sales_profit'        => $salesProfit,
            // Purchases
            'total_purchases'     => $totalPurchases,
            'purchase_amount'     => $purchaseAmount,
            // Expenses
            'total_expenses'      => $totalExpenses,
            // Summary
            'total_income'        => $totalIncome,
            'net_profit'          => $netProfit,
            // Inventory
            'stock_summary'       => $stockSummary,
            'current_month'       => $currentMonth,
        ]);
    }

    /**
     * GET /api/reports/profit-loss
     */
    public function profitLoss(Request $request)
    {
        return response()->json(
            $this->accountingService->getProfitLoss($request->from, $request->to)
        );
    }

    /**
     * GET /api/reports/daily
     * Daily income/expense breakdown.
     */
    public function daily(Request $request)
    {
        $from = $request->from ?? now()->subDays(30)->toDateString();
        $to   = $request->to ?? now()->toDateString();

        $reports = DailyReport::whereBetween('report_date', [$from, $to])
            ->orderBy('report_date', 'desc')
            ->get();

        return response()->json([
            'from'    => $from,
            'to'      => $to,
            'reports' => $reports,
            'summary' => [
                'total_income'  => $reports->sum('total_income'),
                'total_expense' => $reports->sum('total_expense'),
                'net_profit'    => $reports->sum('net_profit'),
            ],
        ]);
    }

    /**
     * GET /api/reports/monthly
     * Monthly summary with comparison.
     */
    public function monthly(Request $request)
    {
        $year = $request->get('year', now()->year);

        $monthlyData = [];

        for ($m = 1; $m <= 12; $m++) {
            $monthStart = "{$year}-" . str_pad($m, 2, '0', STR_PAD_LEFT) . "-01";
            $monthEnd   = date('Y-m-t', strtotime($monthStart));
            $monthLabel = date('M Y', strtotime($monthStart));

            $billingIncome = (float) Payment::where('status', 'completed')
                ->whereMonth('paid_at', $m)->whereYear('paid_at', $year)
                ->sum('amount');

            $salesIncome = (float) Sale::whereBetween('sale_date', [$monthStart, $monthEnd])
                ->where('status', '!=', 'cancelled')
                ->sum('total');

            $purchaseExp = (float) Purchase::whereBetween('purchase_date', [$monthStart, $monthEnd])
                ->sum('total');

            $otherExp = (float) Expense::where('status', 'approved')
                ->whereBetween('expense_date', [$monthStart, $monthEnd])
                ->sum('amount');

            $totalIncome  = $billingIncome + $salesIncome;
            $totalExpense = $purchaseExp + $otherExp;

            $monthlyData[] = [
                'month'          => $monthLabel,
                'month_num'      => $m,
                'billing_income' => $billingIncome,
                'sales_income'   => $salesIncome,
                'total_income'   => $totalIncome,
                'purchase_cost'  => $purchaseExp,
                'other_expense'  => $otherExp,
                'total_expense'  => $totalExpense,
                'net_profit'     => $totalIncome - $totalExpense,
            ];
        }

        return response()->json([
            'year'         => $year,
            'monthly_data' => $monthlyData,
            'yearly_total' => [
                'income'  => collect($monthlyData)->sum('total_income'),
                'expense' => collect($monthlyData)->sum('total_expense'),
                'profit'  => collect($monthlyData)->sum('net_profit'),
            ],
        ]);
    }

    /**
     * GET /api/reports/sales
     */
    public function salesReport(Request $request)
    {
        return response()->json(
            $this->salesService->getProfitReport($request->from, $request->to)
        );
    }

    /**
     * GET /api/reports/vendor-dues
     */
    public function vendorDues()
    {
        $vendors = Vendor::where('balance', '>', 0)
            ->orderBy('balance', 'desc')
            ->get(['id', 'name', 'phone', 'company', 'balance']);

        return response()->json([
            'vendors'   => $vendors,
            'total_due' => $vendors->sum('balance'),
        ]);
    }

    /**
     * GET /api/reports/customer-dues
     */
    public function customerDues()
    {
        $customers = Customer::whereHas('bills', function ($q) {
            $q->where('status', 'unpaid');
        })->with(['bills' => function ($q) {
            $q->where('status', 'unpaid');
        }])->get();

        $result = $customers->map(function ($c) {
            return [
                'id'          => $c->id,
                'customer_id' => $c->customer_id,
                'name'        => $c->name,
                'phone'       => $c->phone,
                'area'        => $c->area,
                'total_due'   => $c->bills->sum('amount'),
                'unpaid_bills'=> $c->bills->count(),
            ];
        })->sortByDesc('total_due')->values();

        return response()->json([
            'customers'  => $result,
            'total_due'  => $result->sum('total_due'),
        ]);
    }

    /**
     * GET /api/reports/stock
     */
    public function stockReport()
    {
        $products = Product::where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json([
            'products'          => $products,
            'summary'           => $this->inventoryService->getStockSummary(),
            'low_stock_items'   => $this->inventoryService->getLowStockProducts(),
        ]);
    }

    /**
     * GET /api/reports/expense-breakdown
     */
    public function expenseBreakdown(Request $request)
    {
        $from = $request->from ?? now()->startOfMonth()->toDateString();
        $to   = $request->to ?? now()->endOfMonth()->toDateString();

        $expenses = Expense::where('status', 'approved')
            ->whereBetween('expense_date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')
            ->orderBy('total', 'desc')
            ->get();

        $purchases = Purchase::whereBetween('purchase_date', [$from, $to])
            ->sum('total');

        return response()->json([
            'from'              => $from,
            'to'                => $to,
            'expense_categories'=> $expenses,
            'total_expenses'    => $expenses->sum('total'),
            'purchase_cost'     => (float) $purchases,
            'grand_total'       => $expenses->sum('total') + (float) $purchases,
        ]);
    }
}

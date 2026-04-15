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
use App\Models\Supplier;
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
     */
    public function dashboard(Request $request)
    {
        $currentMonth = now()->format('Y-m');
        $monthStart   = now()->startOfMonth()->toDateString();
        $monthEnd     = now()->endOfMonth()->toDateString();

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

        $totalSales   = Sale::whereBetween('sale_date', [$monthStart, $monthEnd])->where('status', '!=', 'cancelled')->count();
        $salesRevenue = (float) Sale::whereBetween('sale_date', [$monthStart, $monthEnd])->where('status', '!=', 'cancelled')->sum('total');

        // Calculate profit from sale items (unit_price - buy_price) * quantity
        $salesProfit = 0;
        $saleItems = SaleItem::with('product')
            ->whereHas('sale', function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('sale_date', [$monthStart, $monthEnd])->where('status', '!=', 'cancelled');
            })->get();
        foreach ($saleItems as $item) {
            if ($item->product) {
                $salesProfit += ($item->unit_price - $item->product->buy_price) * $item->quantity;
            }
        }

        $totalPurchases  = Purchase::whereBetween('date', [$monthStart, $monthEnd])->count();
        $purchaseAmount  = (float) Purchase::whereBetween('date', [$monthStart, $monthEnd])->sum('total_amount');

        $totalExpenses = (float) Expense::where('status', 'active')
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->sum('amount');

        $stockSummary = $this->inventoryService->getStockSummary();

        $totalIncome = $billingCollection + $salesRevenue;
        $netProfit   = $totalIncome - $purchaseAmount - $totalExpenses;

        return response()->json([
            'total_customers'     => $totalCustomers,
            'active_customers'    => $activeCustomers,
            'suspended_customers' => $suspendedCustomers,
            'bills_paid'          => $billsPaid,
            'bills_unpaid'        => $billsUnpaid,
            'billing_collection'  => $billingCollection,
            'total_due'           => $totalDue,
            'total_sales'         => $totalSales,
            'sales_revenue'       => $salesRevenue,
            'sales_profit'        => (float) $salesProfit,
            'total_purchases'     => $totalPurchases,
            'purchase_amount'     => $purchaseAmount,
            'total_expenses'      => $totalExpenses,
            'total_income'        => $totalIncome,
            'net_profit'          => $netProfit,
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
     */
    public function daily(Request $request)
    {
        $from = $request->from ?? now()->subDays(30)->toDateString();
        $to   = $request->to ?? now()->toDateString();

        $reports = DailyReport::whereBetween('date', [$from, $to])
            ->orderBy('date', 'desc')
            ->get();

        return response()->json([
            'from'    => $from,
            'to'      => $to,
            'reports' => $reports,
            'summary' => [
                'total_billed'     => $reports->sum('total_billed'),
                'total_collection' => $reports->sum('total_collection'),
                'total_expense'    => $reports->sum('total_expense'),
            ],
        ]);
    }

    /**
     * GET /api/reports/monthly
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

            $purchaseExp = (float) Purchase::whereBetween('date', [$monthStart, $monthEnd])
                ->sum('total_amount');

            $otherExp = (float) Expense::where('status', 'active')
                ->whereBetween('date', [$monthStart, $monthEnd])
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
        $vendors = Supplier::where('total_due', '>', 0)
            ->orderBy('total_due', 'desc')
            ->get(['id', 'name', 'phone', 'company', 'total_due']);

        return response()->json([
            'vendors'   => $vendors,
            'total_due' => $vendors->sum('total_due'),
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
        $products = Product::where('status', 'active')
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

        $expenses = Expense::where('status', 'active')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')
            ->orderBy('total', 'desc')
            ->get();

        $purchases = Purchase::whereBetween('date', [$from, $to])
            ->sum('total_amount');

        return response()->json([
            'from'              => $from,
            'to'                => $to,
            'expense_categories'=> $expenses,
            'total_expenses'    => $expenses->sum('total'),
            'purchase_cost'     => (float) $purchases,
            'grand_total'       => $expenses->sum('total') + (float) $purchases,
        ]);
    }

    /**
     * GET /api/reports/financial-statement
     */
    public function financialStatement(Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->toDateString());

        $totalIncome   = Payment::whereBetween('paid_at', [$from, $to])->where('status', 'completed')->sum('amount');
        $totalExpenses = Expense::whereBetween('date', [$from, $to])->where('status', 'active')->sum('amount');
        $totalSales    = Sale::whereBetween('sale_date', [$from, $to])->where('status', '!=', 'cancelled')->sum('total');
        $totalPurchases = Purchase::whereBetween('date', [$from, $to])->sum('total_amount');

        return response()->json([
            'from'            => $from,
            'to'              => $to,
            'total_income'    => (float) $totalIncome,
            'total_expenses'  => (float) $totalExpenses,
            'total_sales'     => (float) $totalSales,
            'total_purchases' => (float) $totalPurchases,
            'net_profit'      => (float) ($totalIncome + $totalSales - $totalExpenses - $totalPurchases),
        ]);
    }

    /**
     * GET /api/reports/sales-purchase
     */
    public function salesPurchaseReport(Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->endOfMonth()->toDateString());

        $sales = Sale::whereBetween('sale_date', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->with('items.product')
            ->get();

        $purchases = Purchase::whereBetween('date', [$from, $to])
            ->with('items.product', 'supplier')
            ->get();

        return response()->json([
            'from' => $from,
            'to'   => $to,
            'sales' => [
                'count'    => $sales->count(),
                'total'    => (float) $sales->sum('total'),
                'paid'     => (float) $sales->sum('paid_amount'),
                'due'      => (float) ($sales->sum('total') - $sales->sum('paid_amount')),
                'records'  => $sales,
            ],
            'purchases' => [
                'count'    => $purchases->count(),
                'total'    => (float) $purchases->sum('total_amount'),
                'paid'     => (float) $purchases->sum('paid_amount'),
                'due'      => (float) ($purchases->sum('total_amount') - $purchases->sum('paid_amount')),
                'records'  => $purchases,
            ],
        ]);
    }

    /**
     * BTRC Report
     */
    public function btrcReport(Request $request)
    {
        $totalCustomers   = Customer::count();
        $activeCustomers  = Customer::where('status', 'active')->count();
        $inactiveCustomers = Customer::where('status', 'inactive')->count();
        $suspendedCustomers = Customer::where('status', 'suspended')->count();
        $onlineCustomers  = Customer::where('connection_status', 'online')->count();
        $offlineCustomers = Customer::where('connection_status', 'offline')->count();

        // Area-wise breakdown
        $areaBreakdown = Customer::selectRaw("area, COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count")
            ->groupBy('area')
            ->orderBy('total', 'desc')
            ->get();

        return response()->json([
            'total_customers'     => $totalCustomers,
            'active_customers'    => $activeCustomers,
            'inactive_customers'  => $inactiveCustomers,
            'suspended_customers' => $suspendedCustomers,
            'online_customers'    => $onlineCustomers,
            'offline_customers'   => $offlineCustomers,
            'area_breakdown'      => $areaBreakdown,
            'generated_at'        => now()->toIso8601String(),
        ]);
    }

    /**
     * Traffic Monitor
     */
    public function trafficMonitor(Request $request)
    {
        $totalCustomers  = Customer::where('status', 'active')->count();
        $onlineCustomers = Customer::where('connection_status', 'online')->count();

        return response()->json([
            'total_active'  => $totalCustomers,
            'online'        => $onlineCustomers,
            'offline'       => $totalCustomers - $onlineCustomers,
            'bandwidth'     => null,
            'generated_at'  => now()->toIso8601String(),
        ]);
    }
}

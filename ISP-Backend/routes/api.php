<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AccountingHeadController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\BackupRestoreController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BkashController;
use App\Http\Controllers\Api\CustomerAuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmailController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\GenericCrudController;
use App\Http\Controllers\Api\HrController;
use App\Http\Controllers\Api\LanguageController;
use App\Http\Controllers\Api\MerchantPaymentController;
use App\Http\Controllers\Api\MikrotikBillControlController;
use App\Http\Controllers\Api\MikrotikController;
use App\Http\Controllers\Api\NagadController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\SmsBalanceController;
use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\StorageController;
use App\Http\Controllers\Api\SupplierController2;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\WhatsappController;
use App\Http\Controllers\Api\SuperAdminAuthController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\SslCommerzController;
use App\Http\Controllers\Api\ImpersonationController;
use App\Http\Controllers\Api\ActivityLogController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes (no auth)
|--------------------------------------------------------------------------
*/
Route::post('/admin/login', [AuthController::class, 'login'])->middleware('throttle:login');

// ── Super Admin Auth (hidden URL, configurable via .env) ──
$superAdminPath = env('SUPER_ADMIN_PATH', 'admin_login162');
Route::post("/{$superAdminPath}/login", [SuperAdminAuthController::class, 'login'])
    ->middleware('throttle:5,1'); // strict rate limit
Route::post('/portal/login', [CustomerAuthController::class, 'login'])->middleware('throttle:login');
Route::post('/customer/login', [CustomerAuthController::class, 'login'])->middleware('throttle:login');
Route::post('/customer/verify', [CustomerAuthController::class, 'verify']);
Route::post('/impersonate/consume', [ImpersonationController::class, 'consume']);
Route::any('/bkash/callback', [BkashController::class, 'callback']);
Route::any('/nagad/callback', [NagadController::class, 'callback']);

// SSLCommerz callbacks (public — called by SSLCommerz server)
Route::post('/sslcommerz/success', [SslCommerzController::class, 'success']);
Route::post('/sslcommerz/fail', [SslCommerzController::class, 'fail']);
Route::post('/sslcommerz/cancel', [SslCommerzController::class, 'cancel']);
Route::post('/sslcommerz/ipn', [SslCommerzController::class, 'ipn']);

// bKash Pay Bill Webhooks (public — called by bKash server)
Route::post('/bkash-paybill/inquiry', [\App\Http\Controllers\Api\BkashPayBillController::class, 'inquiry']);
Route::post('/bkash-paybill/payment', [\App\Http\Controllers\Api\BkashPayBillController::class, 'payment']);

// Health check endpoint
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'version' => config('app.version', '1.0.2'),
    ]);
});

// ── Public read-only settings (needed for login page branding) ──
Route::get('/general_settings', [GenericCrudController::class, 'index'])->defaults('table', 'general_settings');
Route::get('/general-settings', [GenericCrudController::class, 'index'])->defaults('table', 'general_settings');
Route::get('/system_settings', [GenericCrudController::class, 'index'])->defaults('table', 'system_settings');
Route::get('/system-settings', [GenericCrudController::class, 'index'])->defaults('table', 'system_settings');

// ── HTTP Setup Routes (secured by APP_KEY token) ─────
Route::get('/setup/status', [\App\Http\Controllers\Api\SetupController::class, 'status']);
Route::post('/setup/migrate', [\App\Http\Controllers\Api\SetupController::class, 'migrate']);
Route::post('/setup/seed', [\App\Http\Controllers\Api\SetupController::class, 'seed']);
Route::post('/setup/cache-clear', [\App\Http\Controllers\Api\SetupController::class, 'cacheClear']);
Route::post('/setup/storage-link', [\App\Http\Controllers\Api\SetupController::class, 'storageLink']);
Route::post('/setup/full', [\App\Http\Controllers\Api\SetupController::class, 'full']);
Route::post('/setup/reset-all', [\App\Http\Controllers\Api\SetupController::class, 'resetAll']);

// ── Tenant Info (public — needed for login page branding per tenant) ──
Route::get('/tenant/current', function () {
    $t = tenant();
    if (!$t) {
        return response()->json(['tenant' => null, 'is_central' => true]);
    }
    return response()->json([
        'tenant' => [
            'id' => $t->id,
            'name' => $t->name,
            'subdomain' => $t->subdomain,
            'logo_url' => $t->logo_url,
            'status' => $t->status,
            'plan' => $t->plan,
        ],
        'is_central' => false,
    ]);
});

/*
|--------------------------------------------------------------------------
| Admin Protected Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['admin.auth', 'check.subscription'])->group(function () {

    // ══════════════════════════════════════════════════════
    // ── AUTH (no permission needed) ──────────────────────
    // ══════════════════════════════════════════════════════
    Route::post('/admin/logout', [AuthController::class, 'logout']);
    Route::get('/admin/me', [AuthController::class, 'me']);
    Route::put('/admin/profile', [AuthController::class, 'updateProfile']);
    Route::post('/admin/force-password-change', [AuthController::class, 'forcePasswordChange']);
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Language preference
    Route::get('/language', [LanguageController::class, 'show']);
    Route::put('/language', [LanguageController::class, 'update']);

    // ══════════════════════════════════════════════════════
    // ── ADMIN USERS — module: users ─────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware('check.permission:users,view')->group(function () {
        Route::get('/admin-users', [AdminUserController::class, 'index']);
    });
    Route::middleware('check.permission:users,create')->group(function () {
        Route::post('/admin-users', [AdminUserController::class, 'store']);
    });
    Route::middleware('check.permission:users,edit')->group(function () {
        Route::put('/admin-users/{id}', [AdminUserController::class, 'update']);
    });
    Route::middleware('check.permission:users,delete')->group(function () {
        Route::delete('/admin-users/{id}', [AdminUserController::class, 'destroy']);
    });

    // ══════════════════════════════════════════════════════
    // ── BILLING — module: billing ───────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:billing', 'check.permission:billing,view'])->group(function () {
        Route::get('/billing/cycle-overview', [BillController::class, 'cycleOverview']);
    });
    Route::middleware(['check.plan_module:billing', 'check.permission:billing,create'])->group(function () {
        Route::post('/bills', [BillController::class, 'store']);
        Route::post('/bills/generate', [BillController::class, 'generate']);
    });
    Route::middleware(['check.plan_module:billing', 'check.permission:billing,edit'])->group(function () {
        Route::put('/bills/{id}', [BillController::class, 'update']);
    });
    Route::middleware(['check.plan_module:billing', 'check.permission:billing,delete'])->group(function () {
        Route::delete('/bills/{id}', [BillController::class, 'destroy']);
    });

    // ══════════════════════════════════════════════════════
    // ── PAYMENTS — module: payments ─────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:payments', 'check.permission:payments,create'])->group(function () {
        Route::post('/payments', [PaymentController::class, 'store']);
    });
    Route::middleware(['check.plan_module:payments', 'check.permission:payments,edit'])->group(function () {
        Route::put('/payments/{id}', [PaymentController::class, 'update']);
    });
    Route::middleware(['check.plan_module:payments', 'check.permission:payments,delete'])->group(function () {
        Route::delete('/payments/{id}', [PaymentController::class, 'destroy']);
    });

    // ══════════════════════════════════════════════════════
    // ── MERCHANT PAYMENTS — module: merchant_payments ───
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:merchant_payments', 'check.permission:merchant_payments,view'])->group(function () {
        Route::get('/merchant-payments/reports', [MerchantPaymentController::class, 'reports']);
    });
    Route::middleware(['check.plan_module:merchant_payments', 'check.permission:merchant_payments,create'])->group(function () {
        Route::post('/merchant-payments', [MerchantPaymentController::class, 'store']);
        Route::post('/merchant-payments/import', [MerchantPaymentController::class, 'import']);
        Route::post('/merchant-payments/{id}/match', [MerchantPaymentController::class, 'match']);
    });

    // ══════════════════════════════════════════════════════
    // ── SMS & EMAIL — module: sms ───────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:sms', 'check.permission:sms,create'])->group(function () {
        Route::post('/sms/send', [SmsController::class, 'send']);
        Route::post('/sms/send-bulk', [SmsController::class, 'sendBulk']);
        Route::get('/sms/balance', [SmsBalanceController::class, 'check']);
        Route::post('/whatsapp/send', [WhatsappController::class, 'send']);
        Route::post('/whatsapp/send-bulk', [WhatsappController::class, 'sendBulk']);
        Route::post('/email/send', [EmailController::class, 'send']);
    });

    // ══════════════════════════════════════════════════════
    // ── PAYMENT GATEWAYS (bKash/Nagad) — module: settings
    // ══════════════════════════════════════════════════════
    Route::middleware('check.permission:settings,edit')->group(function () {
        Route::post('/bkash/create-payment', [BkashController::class, 'createPayment']);
        Route::post('/bkash/execute-payment', [BkashController::class, 'executePayment']);
        Route::post('/bkash/refund', [BkashController::class, 'refund']);
        Route::post('/bkash/query-transaction', [BkashController::class, 'queryTransaction']);
        Route::post('/bkash/test-connection', [BkashController::class, 'testConnection']);
        Route::post('/nagad/create-payment', [NagadController::class, 'createPayment']);
        Route::post('/nagad/query-transaction', [NagadController::class, 'queryTransaction']);
        Route::post('/nagad/refund', [NagadController::class, 'refund']);
        Route::post('/sslcommerz/create-payment', [SslCommerzController::class, 'createPayment']);
        Route::post('/sslcommerz/test-connection', [SslCommerzController::class, 'testConnection']);
    });

    // ══════════════════════════════════════════════════════
    // ── MIKROTIK — module: settings ─────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware('check.permission:settings,edit')->group(function () {
        Route::post('/mikrotik/sync', [MikrotikController::class, 'sync']);
        Route::post('/mikrotik/sync-all', [MikrotikController::class, 'syncAll']);
        Route::post('/mikrotik/test-connection', [MikrotikController::class, 'testConnection']);
        Route::post('/mikrotik/bill-control', [MikrotikBillControlController::class, 'billControl']);
        Route::post('/mikrotik/disable-pppoe', [MikrotikBillControlController::class, 'disablePppoe']);
        Route::post('/mikrotik/enable-pppoe', [MikrotikBillControlController::class, 'enablePppoe']);
        Route::post('/mikrotik/sync-profile', [MikrotikBillControlController::class, 'syncProfile']);
        Route::post('/mikrotik/remove-profile', [MikrotikBillControlController::class, 'removeProfile']);
        Route::post('/mikrotik/bulk-sync-packages', [MikrotikBillControlController::class, 'bulkSyncPackages']);
        Route::post('/mikrotik/router-stats', [MikrotikBillControlController::class, 'allRouterStats']);
        Route::get('/mikrotik/router-stats/{routerId}', [MikrotikBillControlController::class, 'routerStats']);
        Route::post('/mikrotik/import-users', [MikrotikBillControlController::class, 'importUsers']);
        Route::post('/mikrotik/import-packages', [MikrotikBillControlController::class, 'importPackages']);
        // IP Pool sync
        Route::post('/mikrotik/sync-ip-pools', [\App\Http\Controllers\Api\IpPoolController::class, 'syncFromRouter']);
        Route::post('/mikrotik/push-ip-pool', [\App\Http\Controllers\Api\IpPoolController::class, 'pushToRouter']);
        Route::post('/mikrotik/push-all-ip-pools', [\App\Http\Controllers\Api\IpPoolController::class, 'pushAllToRouter']);
        Route::post('/mikrotik/queue-sync-ip-pools', [\App\Http\Controllers\Api\IpPoolController::class, 'queueSync']);
    });

    // ══════════════════════════════════════════════════════
    // ── ACCOUNTING & INVENTORY — module: accounting ─────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,view'])->group(function () {
        // Vendors
        Route::get('/vendors', [VendorController::class, 'index']);
        Route::get('/vendors/{id}', [VendorController::class, 'show']);
        // Products
        Route::get('/products', [ProductController::class, 'index']);
        Route::get('/products/stock-summary', [ProductController::class, 'stockSummary']);
        Route::get('/products/low-stock', [ProductController::class, 'lowStock']);
        Route::get('/products/{id}', [ProductController::class, 'show']);
        // Purchases
        Route::get('/purchases', [PurchaseController::class, 'index']);
        Route::get('/purchases/vendor/{vendorId}', [PurchaseController::class, 'vendorHistory']);
        Route::get('/purchases/{id}', [PurchaseController::class, 'show']);
        // Sales
        Route::get('/sales', [SalesController::class, 'index']);
        Route::get('/sales/profit-report', [SalesController::class, 'profitReport']);
        Route::get('/sales/{id}', [SalesController::class, 'show']);
        // Expenses
        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
        Route::get('/expenses/{id}', [ExpenseController::class, 'show']);
        // Accounting Core
        Route::get('/accounting/chart-of-accounts', [AccountingController::class, 'chartOfAccounts']);
        Route::get('/accounting/accounts', [AccountingController::class, 'accounts']);
        Route::get('/accounting/transactions', [AccountingController::class, 'transactions']);
        Route::get('/accounting/summary', [AccountingController::class, 'summary']);
        Route::get('/accounting/balances', [AccountingController::class, 'accountBalances']);
        Route::get('/accounting/profit-loss', [AccountingController::class, 'profitLoss']);
        Route::get('/accounting/balance-sheet', [AccountingController::class, 'balanceSheet']);
        // Accounting Reports
        Route::get('/accounting/trial-balance', [AccountingController::class, 'trialBalance']);
        Route::get('/accounting/cash-flow', [AccountingController::class, 'cashFlow']);
        Route::get('/accounting/daybook', [AccountingController::class, 'daybook']);
        Route::get('/accounting/ledger-statement', [AccountingController::class, 'ledgerStatement']);
        Route::get('/accounting/receivable-payable', [AccountingController::class, 'receivablePayable']);
        Route::get('/accounting/equity-changes', [AccountingController::class, 'equityChanges']);
        Route::get('/accounting/cheque-register', [AccountingController::class, 'chequeRegister']);
        Route::get('/accounting/all-ledgers', [AccountingController::class, 'allLedgers']);
    });
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,create'])->group(function () {
        Route::post('/vendors', [VendorController::class, 'store']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::post('/purchases', [PurchaseController::class, 'store']);
        Route::post('/purchases/{id}/pay', [PurchaseController::class, 'addPayment']);
        Route::post('/sales', [SalesController::class, 'store']);
        Route::post('/sales/{id}/pay', [SalesController::class, 'addPayment']);
        Route::post('/sales/{id}/cancel', [SalesController::class, 'cancel']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::post('/accounting/accounts', [AccountingController::class, 'createAccount']);
        Route::post('/accounting/transactions', [AccountingController::class, 'storeTransaction']);
        Route::post('/accounting/journal-entries', [AccountingController::class, 'storeJournalEntry']);
    });
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,edit'])->group(function () {
        Route::put('/vendors/{id}', [VendorController::class, 'update']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::put('/expenses/{id}', [ExpenseController::class, 'update']);
        Route::put('/accounting/accounts/{id}', [AccountingController::class, 'updateAccount']);
        Route::put('/accounting/transactions/{id}', [AccountingController::class, 'updateTransaction']);
        Route::post('/accounting/recalculate-balances', [AccountingController::class, 'recalculateBalances']);
    });
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,delete'])->group(function () {
        Route::delete('/vendors/{id}', [VendorController::class, 'destroy']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::delete('/purchases/{id}', [PurchaseController::class, 'destroy']);
        Route::delete('/sales/{id}', [SalesController::class, 'destroy']);
        Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);
        Route::delete('/accounting/accounts/{id}', [AccountingController::class, 'deleteAccount']);
        Route::delete('/accounting/transactions/{id}', [AccountingController::class, 'deleteTransaction']);
    });

    // ── Accounting Heads — module: accounting ────────────
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,view'])->group(function () {
        Route::get('/accounting/income-heads', [AccountingHeadController::class, 'incomeHeads']);
        Route::get('/accounting/expense-heads', [AccountingHeadController::class, 'expenseHeads']);
        Route::get('/accounting/other-heads', [AccountingHeadController::class, 'otherHeads']);
    });
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,create'])->group(function () {
        Route::post('/accounting/income-heads', [AccountingHeadController::class, 'storeIncomeHead']);
        Route::post('/accounting/expense-heads', [AccountingHeadController::class, 'storeExpenseHead']);
        Route::post('/accounting/other-heads', [AccountingHeadController::class, 'storeOtherHead']);
    });
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,edit'])->group(function () {
        Route::put('/accounting/income-heads/{id}', [AccountingHeadController::class, 'updateIncomeHead']);
        Route::put('/accounting/expense-heads/{id}', [AccountingHeadController::class, 'updateExpenseHead']);
        Route::put('/accounting/other-heads/{id}', [AccountingHeadController::class, 'updateOtherHead']);
    });
    Route::middleware(['check.plan_module:accounting', 'check.permission:accounting,delete'])->group(function () {
        Route::delete('/accounting/income-heads/{id}', [AccountingHeadController::class, 'deleteIncomeHead']);
        Route::delete('/accounting/expense-heads/{id}', [AccountingHeadController::class, 'deleteExpenseHead']);
        Route::delete('/accounting/other-heads/{id}', [AccountingHeadController::class, 'deleteOtherHead']);
    });

    // ══════════════════════════════════════════════════════
    // ── REPORTS — module: reports ────────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:reports', 'check.permission:reports,view'])->group(function () {
        Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/reports/profit-loss', [ReportController::class, 'profitLoss']);
        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/monthly', [ReportController::class, 'monthly']);
        Route::get('/reports/sales', [ReportController::class, 'salesReport']);
        Route::get('/reports/sales-purchase', [ReportController::class, 'salesPurchaseReport']);
        Route::get('/reports/vendor-dues', [ReportController::class, 'vendorDues']);
        Route::get('/reports/customer-dues', [ReportController::class, 'customerDues']);
        Route::get('/reports/stock', [ReportController::class, 'stockReport']);
        Route::get('/reports/expense-breakdown', [ReportController::class, 'expenseBreakdown']);
        Route::get('/reports/financial-statement', [ReportController::class, 'financialStatement']);
        Route::get('/reports/btrc', [ReportController::class, 'btrcReport']);
        Route::get('/reports/traffic', [ReportController::class, 'trafficMonitor']);
    });

    // ══════════════════════════════════════════════════════
    // ── HUMAN RESOURCE — module: hr ─────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:hr', 'check.permission:hr,view'])->group(function () {
        Route::get('/hr/designations', [HrController::class, 'designations']);
        Route::get('/hr/employees', [HrController::class, 'employees']);
        Route::get('/hr/employees/{id}', [HrController::class, 'employeeProfile']);
        Route::get('/hr/attendance/daily', [HrController::class, 'dailyAttendance']);
        Route::get('/hr/attendance/monthly', [HrController::class, 'monthlyAttendance']);
        Route::get('/hr/loans', [HrController::class, 'loans']);
        Route::get('/hr/salary', [HrController::class, 'salarySheets']);
    });
    Route::middleware(['check.plan_module:hr', 'check.permission:hr,create'])->group(function () {
        Route::post('/hr/designations', [HrController::class, 'storeDesignation']);
        Route::post('/hr/employees', [HrController::class, 'storeEmployee']);
        Route::post('/hr/attendance', [HrController::class, 'storeAttendance']);
        Route::post('/hr/attendance/bulk', [HrController::class, 'bulkAttendance']);
        Route::post('/hr/loans', [HrController::class, 'storeLoan']);
        Route::post('/hr/salary/generate', [HrController::class, 'generateSalary']);
        Route::post('/hr/salary/{id}/pay', [HrController::class, 'paySalary']);
    });
    Route::middleware(['check.plan_module:hr', 'check.permission:hr,edit'])->group(function () {
        Route::put('/hr/designations/{id}', [HrController::class, 'updateDesignation']);
        Route::put('/hr/employees/{id}', [HrController::class, 'updateEmployee']);
        Route::put('/hr/loans/{id}', [HrController::class, 'updateLoan']);
        Route::put('/hr/salary/{id}', [HrController::class, 'updateSalarySheet']);
    });
    Route::middleware(['check.plan_module:hr', 'check.permission:hr,delete'])->group(function () {
        Route::delete('/hr/designations/{id}', [HrController::class, 'deleteDesignation']);
        Route::delete('/hr/employees/{id}', [HrController::class, 'deleteEmployee']);
        Route::delete('/hr/loans/{id}', [HrController::class, 'deleteLoan']);
    });

    // ══════════════════════════════════════════════════════
    // ── SUPPLIER — module: supplier ─────────────────────
    // ══════════════════════════════════════════════════════
    Route::middleware(['check.plan_module:supplier', 'check.permission:supplier,view'])->group(function () {
        Route::get('/suppliers', [SupplierController2::class, 'index']);
        Route::get('/suppliers/{id}', [SupplierController2::class, 'show']);
        Route::get('/supplier-payments', [SupplierController2::class, 'payments']);
        Route::get('/supplier-purchases', [SupplierController2::class, 'purchases']);
    });
    Route::middleware(['check.plan_module:supplier', 'check.permission:supplier,create'])->group(function () {
        Route::post('/suppliers', [SupplierController2::class, 'store']);
        Route::post('/supplier-payments', [SupplierController2::class, 'storePayment']);
    });
    Route::middleware(['check.plan_module:supplier', 'check.permission:supplier,edit'])->group(function () {
        Route::put('/suppliers/{id}', [SupplierController2::class, 'update']);
    });
    Route::middleware(['check.plan_module:supplier', 'check.permission:supplier,delete'])->group(function () {
        Route::delete('/suppliers/{id}', [SupplierController2::class, 'destroy']);
        Route::delete('/supplier-payments/{id}', [SupplierController2::class, 'deletePayment']);
    });

    // ══════════════════════════════════════════════════════
    // ── BACKUP & RESTORE — module: settings ─────────────
    // ══════════════════════════════════════════════════════
    Route::middleware('check.permission:settings,view')->group(function () {
        Route::post('/backup-restore', [BackupRestoreController::class, 'handle']);
    });

    // ══════════════════════════════════════════════════════
    // ── STORAGE (no specific permission, admin only) ────
    // ══════════════════════════════════════════════════════
    Route::post('/storage/upload', [StorageController::class, 'upload']);
    Route::get('/storage/list', [StorageController::class, 'list']);
    Route::get('/storage/download', [StorageController::class, 'download']);
    Route::post('/storage/delete', [StorageController::class, 'delete']);
    Route::get('/storage/serve/{bucket}/{path}', [StorageController::class, 'serve'])->where('path', '.*');

    // ══════════════════════════════════════════════════════
    // ── DOMAIN MANAGEMENT — module: settings ────────────
    // ══════════════════════════════════════════════════════
    Route::middleware('check.permission:settings,view')->group(function () {
        Route::get('/domains', [\App\Http\Controllers\Api\DomainController::class, 'index']);
    });
    Route::middleware('check.permission:settings,edit')->group(function () {
        Route::post('/domains', [\App\Http\Controllers\Api\DomainController::class, 'store']);
        Route::post('/domains/{id}/primary', [\App\Http\Controllers\Api\DomainController::class, 'setPrimary']);
        Route::post('/domains/{id}/verify', [\App\Http\Controllers\Api\DomainController::class, 'verify']);
        Route::delete('/domains/{id}', [\App\Http\Controllers\Api\DomainController::class, 'destroy']);
    });

    // ══════════════════════════════════════════════════════
    // ── ACTIVITY LOGS & LOGIN HISTORY ───────────────────
    // ══════════════════════════════════════════════════════
    Route::get('/activity-logs', [ActivityLogController::class, 'activityLogs']);
    Route::get('/login-history', [ActivityLogController::class, 'loginHistory']);

    // ══════════════════════════════════════════════════════
    // ── SESSION MANAGEMENT ──────────────────────────────
    // ══════════════════════════════════════════════════════
    Route::get('/sessions/my', [\App\Http\Controllers\Api\SessionManagementController::class, 'mySessions']);
    Route::post('/sessions/{id}/terminate', [\App\Http\Controllers\Api\SessionManagementController::class, 'terminateSession']);
    Route::post('/sessions/terminate-others', [\App\Http\Controllers\Api\SessionManagementController::class, 'terminateOtherSessions']);

    // ══════════════════════════════════════════════════════
    // ── GENERIC CRUD — catches remaining tables ─────────
    // ══════════════════════════════════════════════════════
    Route::get('/{table}', [GenericCrudController::class, 'index']);
    Route::get('/{table}/{id}', [GenericCrudController::class, 'show']);
    Route::post('/{table}', [GenericCrudController::class, 'store']);
    Route::put('/{table}/{id}', [GenericCrudController::class, 'update']);
    Route::delete('/{table}/{id}', [GenericCrudController::class, 'destroy']);
});

/*
|--------------------------------------------------------------------------
| Customer Portal Protected Routes
|--------------------------------------------------------------------------
*/
/*
|--------------------------------------------------------------------------
| Super Admin Protected Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['super.admin.auth'])->prefix('super-admin')->group(function () {
    Route::post('/logout', [SuperAdminAuthController::class, 'logout']);
    Route::get('/me', [SuperAdminAuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard', [SuperAdminController::class, 'dashboard']);

    // Tenant Management
    Route::get('/tenants', [SuperAdminController::class, 'tenants']);
    Route::post('/tenants', [SuperAdminController::class, 'createTenant']);
    Route::put('/tenants/{id}', [SuperAdminController::class, 'updateTenant']);
    Route::post('/tenants/{id}/suspend', [SuperAdminController::class, 'suspendTenant']);
    Route::post('/tenants/{id}/activate', [SuperAdminController::class, 'activateTenant']);
    Route::delete('/tenants/{id}', [SuperAdminController::class, 'deleteTenant']);

    // Plan Management
    Route::get('/plans', [SuperAdminController::class, 'plans']);
    Route::post('/plans', [SuperAdminController::class, 'createPlan']);
    Route::put('/plans/{id}', [SuperAdminController::class, 'updatePlan']);
    Route::delete('/plans/{id}', [SuperAdminController::class, 'deletePlan']);

    // Module Management
    Route::get('/modules', [SuperAdminController::class, 'allModules']);
    Route::put('/modules/{id}', [SuperAdminController::class, 'updateModule']);
    Route::get('/tenants/{id}/modules', [SuperAdminController::class, 'tenantModules']);

    // Subscription Management
    Route::get('/subscriptions', [SuperAdminController::class, 'subscriptions']);
    Route::post('/subscriptions', [SuperAdminController::class, 'assignSubscription']);

    // Domain Management (global)
    Route::get('/domains', [SuperAdminController::class, 'allDomains']);
    Route::post('/domains', [SuperAdminController::class, 'assignDomain']);
    Route::delete('/domains/{id}', [SuperAdminController::class, 'removeDomain']);

    // SMS Management (centralized)
    Route::get('/sms-settings', [SuperAdminController::class, 'smsSettings']);
    Route::put('/sms-settings', [SuperAdminController::class, 'updateSmsSettings']);
    Route::get('/sms-wallets', [SuperAdminController::class, 'smsWallets']);
    Route::post('/sms-recharge', [SuperAdminController::class, 'rechargeSms']);
    Route::get('/sms-transactions', [SuperAdminController::class, 'smsTransactions']);

    // Impersonation
    Route::post('/tenants/{id}/impersonate', [ImpersonationController::class, 'generate']);

    // Tenant Users, Activity Logs & Login History
    Route::get('/tenants/{id}/users', [ActivityLogController::class, 'tenantUsers']);
    Route::post('/tenants/{id}/users', [SuperAdminController::class, 'createTenantUser']);
    Route::put('/tenants/{tenantId}/users/{userId}', [ActivityLogController::class, 'updateTenantUser']);
    Route::get('/tenants/{id}/activity-logs', [ActivityLogController::class, 'tenantActivityLogs']);
    Route::get('/tenants/{id}/login-history', [ActivityLogController::class, 'tenantLoginHistory']);
    Route::get('/tenants/{id}/sessions', [\App\Http\Controllers\Api\SessionManagementController::class, 'tenantSessions']);
    Route::post('/sessions/{id}/force-terminate', [\App\Http\Controllers\Api\SessionManagementController::class, 'forceTerminate']);

    // SMTP Management (centralized)
    Route::get('/smtp-settings', [SuperAdminController::class, 'smtpSettings']);
    Route::put('/smtp-settings', [SuperAdminController::class, 'updateSmtpSettings']);
    Route::post('/smtp-test', [SuperAdminController::class, 'testSmtp']);
});

/*
|--------------------------------------------------------------------------
| Customer Portal Protected Routes
|--------------------------------------------------------------------------
*/
Route::middleware('customer.auth')->prefix('portal')->group(function () {
    Route::post('/logout', [CustomerAuthController::class, 'logout']);
    Route::get('/verify', [CustomerAuthController::class, 'verify']);
    Route::get('/dashboard', [PortalController::class, 'dashboard']);
    Route::get('/bills', [PortalController::class, 'bills']);
    Route::get('/payments', [PortalController::class, 'payments']);
    Route::get('/tickets', [PortalController::class, 'tickets']);
    Route::post('/tickets', [PortalController::class, 'createTicket']);
    Route::post('/tickets/{id}/reply', [PortalController::class, 'replyTicket']);
    Route::get('/profile', [PortalController::class, 'profile']);
    Route::put('/profile', [PortalController::class, 'updateProfile']);
});

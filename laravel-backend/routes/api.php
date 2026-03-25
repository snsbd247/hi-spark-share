<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BkashController;
use App\Http\Controllers\Api\CustomerAuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmailController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\GenericCrudController;
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
use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\StorageController;
use App\Http\Controllers\Api\VendorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin Auth (public)
|--------------------------------------------------------------------------
*/
Route::post('/admin/login', [AuthController::class, 'login'])->middleware('throttle:login');

/*
|--------------------------------------------------------------------------
| Customer Portal Auth (public)
|--------------------------------------------------------------------------
*/
Route::post('/portal/login', [CustomerAuthController::class, 'login'])->middleware('throttle:login');

/*
|--------------------------------------------------------------------------
| Payment Callbacks (public — no auth required)
|--------------------------------------------------------------------------
*/
Route::any('/bkash/callback', [BkashController::class, 'callback']);
Route::any('/nagad/callback', [NagadController::class, 'callback']);

/*
|--------------------------------------------------------------------------
| Admin Protected Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['admin.auth', 'tenant'])->group(function () {

    // ══════════════════════════════════════════════════════
    // ── CORE ISP MODULE ──────────────────────────────────
    // ══════════════════════════════════════════════════════

    // ── Auth ──────────────────────────────────────────────
    Route::post('/admin/logout', [AuthController::class, 'logout']);
    Route::get('/admin/me', [AuthController::class, 'me']);

    // ── Dashboard ────────────────────────────────────────
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // ── Admin Users (CRUD) ───────────────────────────────
    Route::get('/admin-users', [AdminUserController::class, 'index']);
    Route::post('/admin-users', [AdminUserController::class, 'store']);
    Route::put('/admin-users/{id}', [AdminUserController::class, 'update']);
    Route::delete('/admin-users/{id}', [AdminUserController::class, 'destroy']);

    // ── Bills ────────────────────────────────────────────
    Route::post('/bills', [BillController::class, 'store']);
    Route::post('/bills/generate', [BillController::class, 'generate']);
    Route::put('/bills/{id}', [BillController::class, 'update']);
    Route::delete('/bills/{id}', [BillController::class, 'destroy']);

    // ── Payments ─────────────────────────────────────────
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::put('/payments/{id}', [PaymentController::class, 'update']);
    Route::delete('/payments/{id}', [PaymentController::class, 'destroy']);

    // ── Merchant Payments ────────────────────────────────
    Route::post('/merchant-payments', [MerchantPaymentController::class, 'store']);
    Route::post('/merchant-payments/{id}/match', [MerchantPaymentController::class, 'match']);

    // ── SMS & Email ──────────────────────────────────────
    Route::post('/sms/send', [SmsController::class, 'send']);
    Route::post('/sms/send-bulk', [SmsController::class, 'sendBulk']);
    Route::post('/email/send', [EmailController::class, 'send']);

    // ── bKash & Nagad ────────────────────────────────────
    Route::post('/bkash/create-payment', [BkashController::class, 'createPayment']);
    Route::post('/nagad/create-payment', [NagadController::class, 'createPayment']);

    // ── MikroTik — core ──────────────────────────────────
    Route::post('/mikrotik/sync', [MikrotikController::class, 'sync']);
    Route::post('/mikrotik/sync-all', [MikrotikController::class, 'syncAll']);
    Route::post('/mikrotik/test-connection', [MikrotikController::class, 'testConnection']);

    // ── MikroTik — extended ──────────────────────────────
    Route::post('/mikrotik/bill-control', [MikrotikBillControlController::class, 'billControl']);
    Route::post('/mikrotik/disable-pppoe', [MikrotikBillControlController::class, 'disablePppoe']);
    Route::post('/mikrotik/enable-pppoe', [MikrotikBillControlController::class, 'enablePppoe']);
    Route::post('/mikrotik/sync-profile', [MikrotikBillControlController::class, 'syncProfile']);
    Route::post('/mikrotik/remove-profile', [MikrotikBillControlController::class, 'removeProfile']);
    Route::post('/mikrotik/bulk-sync-packages', [MikrotikBillControlController::class, 'bulkSyncPackages']);
    Route::get('/mikrotik/router-stats/{routerId}', [MikrotikBillControlController::class, 'routerStats']);

    // ══════════════════════════════════════════════════════
    // ── ACCOUNTING & INVENTORY MODULE ────────────────────
    // ══════════════════════════════════════════════════════

    // ── Vendors (CRUD) ───────────────────────────────────
    Route::get('/vendors', [VendorController::class, 'index']);
    Route::get('/vendors/{id}', [VendorController::class, 'show']);
    Route::post('/vendors', [VendorController::class, 'store']);
    Route::put('/vendors/{id}', [VendorController::class, 'update']);
    Route::delete('/vendors/{id}', [VendorController::class, 'destroy']);

    // ── Products / Inventory (CRUD) ──────────────────────
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/stock-summary', [ProductController::class, 'stockSummary']);
    Route::get('/products/low-stock', [ProductController::class, 'lowStock']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // ── Purchases ────────────────────────────────────────
    Route::get('/purchases', [PurchaseController::class, 'index']);
    Route::get('/purchases/vendor/{vendorId}', [PurchaseController::class, 'vendorHistory']);
    Route::get('/purchases/{id}', [PurchaseController::class, 'show']);
    Route::post('/purchases', [PurchaseController::class, 'store']);
    Route::post('/purchases/{id}/pay', [PurchaseController::class, 'addPayment']);
    Route::delete('/purchases/{id}', [PurchaseController::class, 'destroy']);

    // ── Sales ────────────────────────────────────────────
    Route::get('/sales', [SalesController::class, 'index']);
    Route::get('/sales/profit-report', [SalesController::class, 'profitReport']);
    Route::get('/sales/{id}', [SalesController::class, 'show']);
    Route::post('/sales', [SalesController::class, 'store']);
    Route::post('/sales/{id}/pay', [SalesController::class, 'addPayment']);
    Route::post('/sales/{id}/cancel', [SalesController::class, 'cancel']);
    Route::delete('/sales/{id}', [SalesController::class, 'destroy']);

    // ── Expenses ─────────────────────────────────────────
    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
    Route::get('/expenses/{id}', [ExpenseController::class, 'show']);
    Route::post('/expenses', [ExpenseController::class, 'store']);
    Route::put('/expenses/{id}', [ExpenseController::class, 'update']);
    Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);

    // ── Accounting ───────────────────────────────────────
    Route::get('/accounting/accounts', [AccountingController::class, 'accounts']);
    Route::post('/accounting/accounts', [AccountingController::class, 'createAccount']);
    Route::put('/accounting/accounts/{id}', [AccountingController::class, 'updateAccount']);
    Route::delete('/accounting/accounts/{id}', [AccountingController::class, 'deleteAccount']);

    Route::get('/accounting/transactions', [AccountingController::class, 'transactions']);
    Route::post('/accounting/transactions', [AccountingController::class, 'storeTransaction']);

    Route::get('/accounting/summary', [AccountingController::class, 'summary']);
    Route::get('/accounting/balances', [AccountingController::class, 'accountBalances']);
    Route::get('/accounting/profit-loss', [AccountingController::class, 'profitLoss']);

    // ── Reports ──────────────────────────────────────────
    Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
    Route::get('/reports/profit-loss', [ReportController::class, 'profitLoss']);
    Route::get('/reports/daily', [ReportController::class, 'daily']);
    Route::get('/reports/monthly', [ReportController::class, 'monthly']);
    Route::get('/reports/sales', [ReportController::class, 'salesReport']);
    Route::get('/reports/vendor-dues', [ReportController::class, 'vendorDues']);
    Route::get('/reports/customer-dues', [ReportController::class, 'customerDues']);
    Route::get('/reports/stock', [ReportController::class, 'stockReport']);
    Route::get('/reports/expense-breakdown', [ReportController::class, 'expenseBreakdown']);

    // ── Storage ──────────────────────────────────────────
    Route::post('/storage/upload', [StorageController::class, 'upload']);
    Route::get('/storage/list', [StorageController::class, 'list']);
    Route::get('/storage/download', [StorageController::class, 'download']);
    Route::post('/storage/delete', [StorageController::class, 'delete']);
    Route::get('/storage/serve/{bucket}/{path}', [StorageController::class, 'serve'])->where('path', '.*');

    // ── Generic CRUD — catches all remaining tables ──────
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
Route::middleware('customer.auth')->prefix('portal')->group(function () {
    Route::post('/logout', [CustomerAuthController::class, 'logout']);
    Route::get('/verify', [CustomerAuthController::class, 'verify']);
    Route::get('/dashboard', [PortalController::class, 'dashboard']);
    Route::get('/bills', [PortalController::class, 'bills']);
    Route::get('/payments', [PortalController::class, 'payments']);
    Route::get('/tickets', [PortalController::class, 'tickets']);
    Route::post('/tickets', [PortalController::class, 'createTicket']);
    Route::get('/profile', [PortalController::class, 'profile']);
});

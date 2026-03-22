<?php

use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BkashController;
use App\Http\Controllers\Api\CustomerAuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmailController;
use App\Http\Controllers\Api\GenericCrudController;
use App\Http\Controllers\Api\MerchantPaymentController;
use App\Http\Controllers\Api\MikrotikBillControlController;
use App\Http\Controllers\Api\MikrotikController;
use App\Http\Controllers\Api\NagadController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\StorageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin Auth (public)
|--------------------------------------------------------------------------
*/
Route::post('/admin/login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Customer Portal Auth (public)
|--------------------------------------------------------------------------
*/
Route::post('/portal/login', [CustomerAuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Payment Callbacks (public)
|--------------------------------------------------------------------------
*/
Route::any('/bkash/callback', [BkashController::class, 'callback']);
Route::any('/nagad/callback', [NagadController::class, 'callback']);

/*
|--------------------------------------------------------------------------
| Admin Protected Routes
|--------------------------------------------------------------------------
*/
Route::middleware('admin.auth')->group(function () {
    // Auth
    Route::post('/admin/logout', [AuthController::class, 'logout']);
    Route::get('/admin/me', [AuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Admin Users
    Route::get('/admin-users', [AdminUserController::class, 'index']);
    Route::post('/admin-users', [AdminUserController::class, 'store']);
    Route::put('/admin-users/{id}', [AdminUserController::class, 'update']);
    Route::delete('/admin-users/{id}', [AdminUserController::class, 'destroy']);

    // Bills
    Route::post('/bills', [BillController::class, 'store']);
    Route::post('/bills/generate', [BillController::class, 'generate']);
    Route::put('/bills/{id}', [BillController::class, 'update']);
    Route::delete('/bills/{id}', [BillController::class, 'destroy']);

    // Payments
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::put('/payments/{id}', [PaymentController::class, 'update']);
    Route::delete('/payments/{id}', [PaymentController::class, 'destroy']);

    // Merchant Payments
    Route::post('/merchant-payments', [MerchantPaymentController::class, 'store']);
    Route::post('/merchant-payments/{id}/match', [MerchantPaymentController::class, 'match']);

    // SMS & Email
    Route::post('/sms/send', [SmsController::class, 'send']);
    Route::post('/sms/send-bulk', [SmsController::class, 'sendBulk']);
    Route::post('/email/send', [EmailController::class, 'send']);

    // bKash & Nagad
    Route::post('/bkash/create-payment', [BkashController::class, 'createPayment']);
    Route::post('/nagad/create-payment', [NagadController::class, 'createPayment']);

    // MikroTik — core
    Route::post('/mikrotik/sync', [MikrotikController::class, 'sync']);
    Route::post('/mikrotik/sync-all', [MikrotikController::class, 'syncAll']);
    Route::post('/mikrotik/test-connection', [MikrotikController::class, 'testConnection']);

    // MikroTik — extended
    Route::post('/mikrotik/bill-control', [MikrotikBillControlController::class, 'billControl']);
    Route::post('/mikrotik/disable-pppoe', [MikrotikBillControlController::class, 'disablePppoe']);
    Route::post('/mikrotik/enable-pppoe', [MikrotikBillControlController::class, 'enablePppoe']);
    Route::post('/mikrotik/sync-profile', [MikrotikBillControlController::class, 'syncProfile']);
    Route::post('/mikrotik/remove-profile', [MikrotikBillControlController::class, 'removeProfile']);
    Route::post('/mikrotik/bulk-sync-packages', [MikrotikBillControlController::class, 'bulkSyncPackages']);
    Route::get('/mikrotik/router-stats/{routerId}', [MikrotikBillControlController::class, 'routerStats']);

    // Storage
    Route::post('/storage/upload', [StorageController::class, 'upload']);
    Route::get('/storage/list', [StorageController::class, 'list']);
    Route::get('/storage/download', [StorageController::class, 'download']);
    Route::post('/storage/delete', [StorageController::class, 'delete']);
    Route::get('/storage/serve/{bucket}/{path}', [StorageController::class, 'serve'])->where('path', '.*');

    // Generic CRUD — catches all remaining tables
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

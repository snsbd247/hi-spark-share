<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\CustomerWallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use App\Models\Account;
use App\Models\PaymentGateway;
use App\Services\AccountingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WalletController extends Controller
{
    public function __construct(protected WalletService $wallet, protected AccountingService $accounting) {}

    /**
     * Wallet module healthcheck:
     *   - DB reachable + wallet tables present
     *   - Required COA accounts (Cash, Wallet Liability, Revenue) present for tenant
     *   - Payment gateway configs (bKash / Nagad / SSLCommerz) configured for tenant
     */
    public function health(Request $request)
    {
        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        $checks = [];

        // 1) DB
        try {
            DB::select('SELECT 1');
            $checks['database'] = ['ok' => true, 'label' => 'Database reachable'];
        } catch (\Throwable $e) {
            $checks['database'] = ['ok' => false, 'label' => 'Database unreachable', 'error' => $e->getMessage()];
        }

        // 2) Tables
        $tables = ['customer_wallets', 'wallet_transactions'];
        $missing = array_filter($tables, fn($t) => !Schema::hasTable($t));
        $checks['schema'] = [
            'ok'    => empty($missing),
            'label' => empty($missing) ? 'Wallet tables present' : 'Missing tables: '.implode(', ', $missing),
        ];

        // 3) COA accounts (auto-create then verify)
        try { $this->wallet->ensureWalletAccounts($tenantId); } catch (\Throwable $e) {}
        $codes = ['1001' => 'Cash', '2050' => 'Wallet Liability', '4001' => 'Bill Revenue'];
        $accStatus = [];
        foreach ($codes as $code => $name) {
            $a = $this->accounting->accountByCode($code, $tenantId);
            $accStatus[$code] = ['name' => $name, 'present' => (bool) $a, 'account_id' => $a?->id];
        }
        $checks['accounting'] = [
            'ok'       => collect($accStatus)->every(fn($v) => $v['present']),
            'label'    => 'Required COA accounts',
            'accounts' => $accStatus,
        ];

        // 4) Payment gateways
        $gateways = ['bkash', 'nagad', 'sslcommerz'];
        $gwStatus = [];
        if (Schema::hasTable('payment_gateways')) {
            foreach ($gateways as $g) {
                $row = PaymentGateway::query()
                    ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                    ->where('gateway_name', $g)->first();
                $gwStatus[$g] = [
                    'configured' => (bool) $row,
                    'enabled'    => $row ? in_array(strtolower($row->status ?? ''), ['active', 'enabled', '1']) : false,
                ];
            }
        } else {
            foreach ($gateways as $g) $gwStatus[$g] = ['configured' => false, 'enabled' => false];
        }
        $checks['gateways'] = [
            'ok'       => collect($gwStatus)->contains(fn($v) => $v['enabled']),
            'label'    => 'At least one payment gateway enabled',
            'gateways' => $gwStatus,
        ];

        $overall = collect($checks)->every(fn($c) => $c['ok'] ?? false);

        return response()->json([
            'ok'        => $overall,
            'checked_at'=> now()->toIso8601String(),
            'checks'    => $checks,
        ]);
    }


    /** Admin/Reseller: list wallets (with customer summary). */
    public function index(Request $request)
    {
        $q = CustomerWallet::query()->with(['customer:id,customer_id,name,phone,reseller_id']);

        if ($request->filled('search')) {
            $s = $request->search;
            $q->whereHas('customer', function ($c) use ($s) {
                $c->where('name', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%")
                  ->orWhere('customer_id', 'like', "%$s%");
            });
        }
        if ($request->filled('reseller_id')) {
            $q->whereHas('customer', fn($c) => $c->where('reseller_id', $request->reseller_id));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->status);
        }

        return response()->json($q->orderByDesc('balance')->paginate($request->get('per_page', 25)));
    }

    /** Admin: get one wallet by customer id. */
    public function show(string $customerId)
    {
        $wallet = $this->wallet->getWallet($customerId);
        return response()->json($wallet->load('customer:id,customer_id,name,phone'));
    }

    /** Admin/Reseller: credit (top-up) a wallet. */
    public function credit(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid',
            'amount'      => 'required|numeric|min:0.01',
            'gateway'     => 'nullable|string|in:bkash,nagad,sslcommerz,manual,cash',
            'description' => 'nullable|string|max:500',
        ]);

        $admin = $request->get('admin_user');
        $txn = $this->wallet->credit($request->customer_id, (float) $request->amount, [
            'source'      => $request->gateway && $request->gateway !== 'manual' && $request->gateway !== 'cash' ? 'gateway' : 'payment',
            'gateway'     => $request->gateway ?? 'manual',
            'description' => $request->description ?? 'Wallet top-up',
            'created_by'  => $admin?->id,
        ]);

        return response()->json(['success' => true, 'transaction' => $txn, 'balance' => $this->wallet->getBalance($request->customer_id)]);
    }

    /** Admin: debit (manual deduction) a wallet. */
    public function debit(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid',
            'amount'      => 'required|numeric|min:0.01',
            'description' => 'nullable|string|max:500',
        ]);

        $admin = $request->get('admin_user');
        try {
            $txn = $this->wallet->debit($request->customer_id, (float) $request->amount, [
                'source'      => 'adjustment',
                'description' => $request->description ?? 'Manual debit',
                'created_by'  => $admin?->id,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'transaction' => $txn, 'balance' => $this->wallet->getBalance($request->customer_id)]);
    }

    /** Admin: refund to wallet. */
    public function refund(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid',
            'amount'      => 'required|numeric|min:0.01',
            'description' => 'nullable|string|max:500',
        ]);

        $admin = $request->get('admin_user');
        $txn = $this->wallet->refund($request->customer_id, (float) $request->amount, [
            'description' => $request->description ?? 'Refund',
            'created_by'  => $admin?->id,
        ]);

        return response()->json(['success' => true, 'transaction' => $txn]);
    }

    /** Admin/Customer/Reseller: trigger auto-pay on a bill. */
    public function payInvoice(Request $request)
    {
        $request->validate(['bill_id' => 'required|uuid|exists:bills,id']);
        $admin = $request->get('admin_user');
        $result = $this->wallet->autoPayInvoice($request->bill_id, $admin?->id);
        return response()->json($result);
    }

    /** History (admin scope, filterable). */
    public function history(Request $request)
    {
        $q = WalletTransaction::query()->with('customer:id,customer_id,name,phone');
        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('type'))        $q->where('type', $request->type);
        if ($request->filled('source'))      $q->where('source', $request->source);
        if ($request->filled('from'))        $q->whereDate('created_at', '>=', $request->from);
        if ($request->filled('to'))          $q->whereDate('created_at', '<=', $request->to);

        return response()->json($q->orderByDesc('created_at')->paginate($request->get('per_page', 50)));
    }

    /** Admin: freeze/unfreeze. */
    public function setStatus(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid',
            'status'      => 'required|in:active,frozen',
        ]);
        $w = $this->wallet->setStatus($request->customer_id, $request->status);
        return response()->json(['success' => true, 'wallet' => $w]);
    }

    /** Admin/Customer: toggle auto-pay. */
    public function setAutoPay(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid',
            'auto_pay'    => 'required|boolean',
        ]);
        $w = $this->wallet->setAutoPay($request->customer_id, (bool) $request->auto_pay);
        return response()->json(['success' => true, 'wallet' => $w]);
    }

    // ─────────────────────────────────────────────────────────
    // CUSTOMER PORTAL endpoints (uses customer.auth — request->customer)
    // ─────────────────────────────────────────────────────────
    public function myWallet(Request $request)
    {
        $customer = $request->get('customer');
        if (!$customer) return response()->json(['error' => 'unauthenticated'], 401);
        return response()->json($this->wallet->getWallet($customer->id));
    }

    public function myHistory(Request $request)
    {
        $customer = $request->get('customer');
        if (!$customer) return response()->json(['error' => 'unauthenticated'], 401);
        $list = WalletTransaction::where('customer_id', $customer->id)
            ->orderByDesc('created_at')->limit(200)->get();
        return response()->json($list);
    }

    public function myToggleAutoPay(Request $request)
    {
        $customer = $request->get('customer');
        if (!$customer) return response()->json(['error' => 'unauthenticated'], 401);
        $w = $this->wallet->setAutoPay($customer->id, (bool) $request->boolean('auto_pay'));
        return response()->json(['success' => true, 'wallet' => $w]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Reseller;
use App\Models\ResellerWalletTransaction;
use App\Models\ResellerZone;
use Illuminate\Http\Request;

class ResellerController extends Controller
{
    /**
     * Reseller dashboard stats
     */
    public function dashboard(Request $request)
    {
        $reseller = $request->get('reseller_user');

        $customers = Customer::withoutGlobalScopes()
            ->where('reseller_id', $reseller->id)
            ->get();

        $customerIds = $customers->pluck('id');
        $currentMonth = now()->format('Y-m');

        $totalRevenue = $customers->sum('monthly_bill');
        $activeCustomers = $customers->where('connection_status', 'online')->count();

        $billed = Bill::whereIn('customer_id', $customerIds)
            ->where('month', $currentMonth)
            ->sum('amount');

        $collected = Bill::whereIn('customer_id', $customerIds)
            ->where('month', $currentMonth)
            ->where('status', 'paid')
            ->sum('paid_amount');

        $unpaidBills = Bill::whereIn('customer_id', $customerIds)
            ->whereIn('status', ['unpaid', 'overdue'])
            ->count();

        $newThisMonth = $customers->filter(function ($c) use ($currentMonth) {
            return str_starts_with($c->created_at, $currentMonth);
        })->count();

        return response()->json([
            'total_customers' => $customers->count(),
            'active_customers' => $activeCustomers,
            'total_revenue' => $totalRevenue,
            'wallet_balance' => (float) $reseller->wallet_balance,
            'commission_rate' => (float) $reseller->commission_rate,
            'current_month' => $currentMonth,
            'billed' => $billed,
            'collected' => $collected,
            'due' => $billed - $collected,
            'unpaid_bills' => $unpaidBills,
            'new_this_month' => $newThisMonth,
        ]);
    }

    /**
     * List reseller's own customers
     */
    public function customers(Request $request)
    {
        $reseller = $request->get('reseller_user');
        $perPage = $request->input('per_page', 20);

        $query = Customer::withoutGlobalScopes()
            ->where('reseller_id', $reseller->id)
            ->with('package:id,name,price')
            ->orderBy('name');

        if ($area = $request->input('area')) {
            $query->where('area', $area);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('customer_id', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($perPage));
    }

    /**
     * Reseller creates a new customer
     */
    public function storeCustomer(Request $request)
    {
        $reseller = $request->get('reseller_user');

        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'area' => 'required|string|max:255',
            'package_id' => 'required|uuid|exists:packages,id',
            'zone_id' => 'nullable|uuid|exists:reseller_zones,id',
        ]);

        // Force monthly_bill from package price — reseller cannot override
        $package = \App\Models\Package::findOrFail($request->package_id);
        $monthlyBill = (float) $package->price;
        if ($monthlyBill <= 0) {
            return response()->json(['error' => 'Package price must be greater than 0'], 422);
        }

        // SECURITY: Strip fields reseller cannot control
        $request->request->remove('router_id');
        $request->request->remove('pppoe_username');
        $request->request->remove('pppoe_password');
        $request->request->remove('discount');      // Reseller cannot set discount
        $request->request->remove('is_free');        // Reseller cannot create free lines
        $request->request->remove('monthly_bill');   // Forced from package price

        // Auto-generate customer_id
        $lastCustomer = Customer::withoutGlobalScopes()
            ->where('tenant_id', $reseller->tenant_id)
            ->orderByRaw('CAST(customer_id AS INTEGER) DESC')
            ->first();
        $nextId = str_pad(($lastCustomer ? (int)$lastCustomer->customer_id + 1 : 100001), 6, '0', STR_PAD_LEFT);

        // Auto-generate PPPoE credentials
        $pppoeUsername = 'CUST-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
        $pppoePassword = bin2hex(random_bytes(6));

        // Validate zone belongs to this reseller (if provided)
        if ($request->zone_id) {
            $zone = \App\Models\ResellerZone::where('id', $request->zone_id)
                ->where('reseller_id', $reseller->id)
                ->first();
            if (!$zone) {
                return response()->json(['error' => 'Invalid zone'], 422);
            }
        }

        $customer = Customer::withoutGlobalScopes()->create([
            'tenant_id' => $reseller->tenant_id,
            'reseller_id' => $reseller->id,
            'customer_id' => $nextId,
            'name' => $request->name,
            'phone' => $request->phone,
            'area' => $request->area,
            'monthly_bill' => $monthlyBill, // Forced from package price
            'package_id' => $request->package_id,
            'connection_status' => 'online',
            'status' => 'active',
            'zone_id' => $request->zone_id,
            'pppoe_username' => $pppoeUsername,
            'pppoe_password' => $pppoePassword,
            'discount' => 0, // Forced: reseller cannot set discount
        ]);

        return response()->json($customer, 201);
    }

    /**
     * Reseller wallet transactions
     */
    public function walletTransactions(Request $request)
    {
        $reseller = $request->get('reseller_user');

        $transactions = ResellerWalletTransaction::where('reseller_id', $reseller->id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 20));

        return response()->json($transactions);
    }

    /**
     * Collect payment from customer
     */
    public function collectPayment(Request $request)
    {
        $reseller = $request->get('reseller_user');

        $request->validate([
            'customer_id' => 'required|uuid',
            'amount' => 'required|numeric|min:1',
            'bill_id' => 'nullable|uuid|exists:bills,id',
        ]);

        // Verify customer belongs to reseller
        $customer = Customer::withoutGlobalScopes()
            ->where('id', $request->customer_id)
            ->where('reseller_id', $reseller->id)
            ->first();

        if (!$customer) {
            return response()->json(['error' => 'Customer not found or access denied'], 403);
        }

        $payment = Payment::create([
            'customer_id' => $request->customer_id,
            'amount' => $request->amount,
            'payment_method' => 'cash',
            'bill_id' => $request->bill_id,
            'transaction_id' => 'R-' . now()->format('ymdHis'),
            'status' => 'completed',
        ]);

        if ($request->bill_id) {
            $bill = Bill::find($request->bill_id);
            if ($bill) {
                $newPaid = $bill->paid_amount + $request->amount;
                $bill->update([
                    'paid_amount' => $newPaid,
                    'status' => $newPaid >= $bill->amount ? 'paid' : 'partial',
                    'paid_date' => now()->toDateString(),
                ]);
            }
        }

        return response()->json($payment, 201);
    }

    /**
     * Reseller billing — list bills for own customers
     */
    public function bills(Request $request)
    {
        $reseller = $request->get('reseller_user');

        $customerIds = Customer::withoutGlobalScopes()
            ->where('reseller_id', $reseller->id)
            ->pluck('id');

        $query = Bill::whereIn('customer_id', $customerIds)
            ->with('customer:id,name,customer_id,phone')
            ->orderBy('created_at', 'desc');

        if ($month = $request->input('month')) {
            $query->where('month', $month);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        return response()->json($query->paginate($request->input('per_page', 20)));
    }

    /**
     * Reseller reports
     */
    public function reports(Request $request)
    {
        $reseller = $request->get('reseller_user');

        $customers = Customer::withoutGlobalScopes()
            ->where('reseller_id', $reseller->id)
            ->get();
        $customerIds = $customers->pluck('id');

        $currentMonth = now()->format('Y-m');

        // Monthly summary
        $totalBilled = Bill::whereIn('customer_id', $customerIds)
            ->where('month', $currentMonth)
            ->sum('amount');
        $totalCollected = Bill::whereIn('customer_id', $customerIds)
            ->where('month', $currentMonth)
            ->where('status', 'paid')
            ->sum('paid_amount');

        // Wallet summary
        $totalCredits = ResellerWalletTransaction::where('reseller_id', $reseller->id)
            ->where('type', 'credit')
            ->sum('amount');
        $totalDebits = ResellerWalletTransaction::where('reseller_id', $reseller->id)
            ->where('type', 'debit')
            ->sum('amount');

        return response()->json([
            'total_customers' => $customers->count(),
            'active_customers' => $customers->where('connection_status', 'online')->count(),
            'current_month' => $currentMonth,
            'total_billed' => $totalBilled,
            'total_collected' => $totalCollected,
            'total_due' => $totalBilled - $totalCollected,
            'wallet_balance' => (float) $reseller->wallet_balance,
            'total_credits' => $totalCredits,
            'total_debits' => $totalDebits,
        ]);
    }

    // ══════════════════════════════════════════════════════
    // ── ZONE CRUD ────────────────────────────────────────
    // ══════════════════════════════════════════════════════

    public function zones(Request $request)
    {
        $reseller = $request->get('reseller_user');
        return response()->json(
            ResellerZone::where('reseller_id', $reseller->id)
                ->where('tenant_id', $reseller->tenant_id)
                ->orderBy('name')
                ->get()
        );
    }

    public function storeZone(Request $request)
    {
        $reseller = $request->get('reseller_user');
        $request->validate(['name' => 'required|string|max:255']);

        $zone = ResellerZone::create([
            'tenant_id' => $reseller->tenant_id,
            'reseller_id' => $reseller->id,
            'name' => $request->name,
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json($zone, 201);
    }

    public function updateZone(Request $request, $id)
    {
        $reseller = $request->get('reseller_user');
        $zone = ResellerZone::where('id', $id)->where('reseller_id', $reseller->id)->firstOrFail();
        $zone->update($request->only(['name', 'status']));
        return response()->json($zone);
    }

    public function deleteZone(Request $request, $id)
    {
        $reseller = $request->get('reseller_user');
        $zone = ResellerZone::where('id', $id)->where('reseller_id', $reseller->id)->firstOrFail();
        $zone->delete();
        return response()->json(['message' => 'Zone deleted']);
    }

    // ── Profile ──────────────────────────────────────────
    public function profile(Request $request)
    {
        $reseller = $request->get('reseller_user');
        return response()->json($reseller);
    }

    public function updateProfile(Request $request)
    {
        $reseller = $request->get('reseller_user');
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'company_name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string|max:500',
        ]);

        $reseller->update($request->only(['name', 'company_name', 'phone', 'address']));
        return response()->json($reseller->fresh());
    }

    public function changePassword(Request $request)
    {
        $reseller = $request->get('reseller_user');
        $request->validate([
            'old_password' => 'required|string',
            'new_password' => 'required|string|min:6',
        ]);

        if (!$reseller->password_hash || !password_verify($request->old_password, $reseller->password_hash)) {
            return response()->json(['error' => 'Current password is incorrect'], 422);
        }

        $reseller->update(['password_hash' => bcrypt($request->new_password)]);
        return response()->json(['message' => 'Password changed successfully']);
    }
}

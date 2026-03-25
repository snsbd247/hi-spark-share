<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Transaction;
use App\Services\AccountingService;
use Illuminate\Http\Request;

class AccountingController extends Controller
{
    public function __construct(protected AccountingService $accountingService) {}

    // ─── Accounts CRUD ───────────────────────────────────

    public function accounts(Request $request)
    {
        $query = Account::query();

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        return response()->json(
            $query->orderBy('type')->orderBy('name')->get()
        );
    }

    public function createAccount(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:255',
            'type'        => 'required|string|in:asset,liability,income,expense,equity',
            'code'        => 'nullable|string|max:20|unique:accounts,code',
            'description' => 'nullable|string|max:500',
        ]);

        $account = Account::create($request->only([
            'name', 'type', 'code', 'description',
        ]));

        return response()->json($account, 201);
    }

    public function updateAccount(Request $request, string $id)
    {
        $account = Account::findOrFail($id);

        if ($account->is_system) {
            return response()->json(['error' => 'Cannot modify system account'], 422);
        }

        $account->update($request->only([
            'name', 'type', 'code', 'description', 'is_active',
        ]));

        return response()->json($account);
    }

    public function deleteAccount(string $id)
    {
        $account = Account::findOrFail($id);

        if ($account->is_system) {
            return response()->json(['error' => 'Cannot delete system account'], 422);
        }

        if ($account->transactions()->exists()) {
            return response()->json(['error' => 'Cannot delete account with transactions'], 422);
        }

        $account->delete();
        return response()->json(['success' => true]);
    }

    // ─── Transactions ────────────────────────────────────

    public function transactions(Request $request)
    {
        $query = Transaction::with(['account', 'customer', 'vendor', 'createdBy']);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('account_id')) {
            $query->where('account_id', $request->account_id);
        }

        if ($request->has('from') && $request->has('to')) {
            $query->whereBetween('date', [$request->from, $request->to]);
        }

        return response()->json(
            $query->orderBy('date', 'desc')
                ->orderBy('created_at', 'desc')
                ->paginate($request->get('per_page', 50))
        );
    }

    public function storeTransaction(Request $request)
    {
        $request->validate([
            'type'        => 'required|string|in:income,expense',
            'category'    => 'required|string|max:100',
            'amount'      => 'required|numeric|min:0.01',
            'date'        => 'nullable|date',
            'description' => 'nullable|string|max:500',
            'account_id'  => 'nullable|uuid|exists:accounts,id',
            'customer_id' => 'nullable|uuid|exists:customers,id',
            'vendor_id'   => 'nullable|uuid|exists:vendors,id',
        ]);

        $admin = $request->get('admin_user');
        $data  = $request->only([
            'type', 'category', 'amount', 'date', 'description',
            'account_id', 'customer_id', 'vendor_id',
        ]);
        $data['created_by'] = $admin?->id;

        $txn = $request->type === 'income'
            ? $this->accountingService->recordIncome($data)
            : $this->accountingService->recordExpense($data);

        return response()->json($txn, 201);
    }

    // ─── Reports ─────────────────────────────────────────

    public function summary(Request $request)
    {
        return response()->json(
            $this->accountingService->getFinancialSummary($request->from, $request->to)
        );
    }

    public function accountBalances()
    {
        return response()->json(
            $this->accountingService->getAccountBalances()
        );
    }

    public function profitLoss(Request $request)
    {
        return response()->json(
            $this->accountingService->getProfitLoss($request->from, $request->to)
        );
    }
}

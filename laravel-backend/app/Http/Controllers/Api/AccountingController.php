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

    // ─── Chart of Accounts ───────────────────────────────

    public function chartOfAccounts()
    {
        return response()->json(
            $this->accountingService->getChartOfAccounts()
        );
    }

    // ─── Accounts CRUD ───────────────────────────────────

    public function accounts(Request $request)
    {
        $query = Account::with('children');

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('flat', false)) {
            return response()->json(
                Account::orderBy('code')->orderBy('name')->get()
            );
        }

        return response()->json(
            $query->orderBy('code')->orderBy('name')->get()
        );
    }

    public function createAccount(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:255',
            'type'        => 'required|string|in:asset,liability,income,expense,equity',
            'code'        => 'nullable|string|max:20|unique:accounts,code',
            'parent_id'   => 'nullable|uuid|exists:accounts,id',
            'description' => 'nullable|string|max:500',
        ]);

        $level = 0;
        if ($request->parent_id) {
            $parent = Account::find($request->parent_id);
            $level = $parent ? $parent->level + 1 : 0;
        }

        $account = Account::create(array_merge(
            $request->only(['name', 'type', 'code', 'parent_id', 'description']),
            ['level' => $level]
        ));

        return response()->json($account, 201);
    }

    public function updateAccount(Request $request, string $id)
    {
        $account = Account::findOrFail($id);

        if ($account->is_system) {
            return response()->json(['error' => 'Cannot modify system account'], 422);
        }

        $level = $account->level;
        if ($request->has('parent_id') && $request->parent_id !== $account->parent_id) {
            if ($request->parent_id) {
                $parent = Account::find($request->parent_id);
                $level = $parent ? $parent->level + 1 : 0;
            } else {
                $level = 0;
            }
        }

        $account->update(array_merge(
            $request->only(['name', 'type', 'code', 'parent_id', 'description', 'is_active']),
            ['level' => $level]
        ));

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

        if ($account->children()->exists()) {
            return response()->json(['error' => 'Cannot delete account with child accounts'], 422);
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
        if ($request->has('journal_ref')) {
            $query->where('journal_ref', $request->journal_ref);
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

    // ─── Journal Entries ─────────────────────────────────

    public function storeJournalEntry(Request $request)
    {
        $request->validate([
            'description' => 'nullable|string|max:500',
            'entries'     => 'required|array|min:2',
            'entries.*.account_id' => 'required|uuid|exists:accounts,id',
            'entries.*.debit'      => 'nullable|numeric|min:0',
            'entries.*.credit'     => 'nullable|numeric|min:0',
            'entries.*.date'       => 'nullable|date',
        ]);

        $admin = $request->get('admin_user');

        try {
            $journalRef = $this->accountingService->createJournalEntry(
                $request->entries,
                $request->description,
                $admin?->id
            );

            return response()->json([
                'success'     => true,
                'journal_ref' => $journalRef,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
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

    public function balanceSheet(Request $request)
    {
        return response()->json(
            $this->accountingService->getBalanceSheet($request->as_of)
        );
    }
}

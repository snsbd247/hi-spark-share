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

    public function chartOfAccounts()
    {
        return response()->json($this->accountingService->getChartOfAccounts());
    }

    public function accounts(Request $request)
    {
        $query = Account::query();

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('flat', false)) {
            return response()->json(Account::orderBy('code')->orderBy('name')->get());
        }

        return response()->json($query->with('children')->orderBy('code')->orderBy('name')->get());
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

        $level = $account->level;
        if ($request->has('parent_id') && $request->parent_id !== $account->parent_id) {
            $parent = $request->parent_id ? Account::find($request->parent_id) : null;
            $level = $parent ? $parent->level + 1 : 0;
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
        if ($account->children()->exists()) {
            return response()->json(['error' => 'Cannot delete account with child accounts'], 422);
        }

        $account->delete();
        return response()->json(['success' => true]);
    }

    public function transactions(Request $request)
    {
        $query = Transaction::with(['account', 'createdBy']);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }
        if ($request->has('account_id')) {
            $query->where('account_id', $request->account_id);
        }
        if ($request->has('from') && $request->has('to')) {
            $query->whereBetween('date', [$request->from, $request->to]);
        }

        return response()->json(
            $query->orderBy('date', 'desc')->orderBy('created_at', 'desc')
                ->paginate($request->get('per_page', 50))
        );
    }

    public function storeTransaction(Request $request)
    {
        $request->validate([
            'type'        => 'required|string|in:income,expense',
            'amount'      => 'required|numeric|min:0.01',
            'date'        => 'nullable|date',
            'description' => 'required|string|max:500',
            'account_id'  => 'nullable|uuid|exists:accounts,id',
        ]);

        $admin = $request->get('admin_user');
        $data = [
            'amount'      => $request->amount,
            'date'        => $request->date,
            'description' => $request->description,
            'account_id'  => $request->account_id,
            'created_by'  => $admin?->id,
        ];

        $txn = $request->type === 'income'
            ? $this->accountingService->recordIncome($data)
            : $this->accountingService->recordExpense($data);

        return response()->json($txn, 201);
    }

    public function updateTransaction(Request $request, string $id)
    {
        $txn = Transaction::findOrFail($id);
        $txn->update($request->only(['type', 'date', 'description', 'account_id', 'debit', 'credit']));
        return response()->json($txn->fresh()->load('account'));
    }

    public function deleteTransaction(string $id)
    {
        $txn = Transaction::findOrFail($id);

        if ($txn->account_id) {
            $account = Account::find($txn->account_id);
            if ($account) {
                if (in_array($account->type, ['asset', 'expense'])) {
                    $account->decrement('balance', $txn->debit - $txn->credit);
                } else {
                    $account->decrement('balance', $txn->credit - $txn->debit);
                }
            }
        }

        $txn->delete();
        return response()->json(['success' => true]);
    }

    public function storeJournalEntry(Request $request)
    {
        $request->validate([
            'description'          => 'nullable|string|max:500',
            'entries'              => 'required|array|min:2',
            'entries.*.account_id' => 'required|uuid|exists:accounts,id',
            'entries.*.debit'      => 'nullable|numeric|min:0',
            'entries.*.credit'     => 'nullable|numeric|min:0',
        ]);

        $admin = $request->get('admin_user');

        try {
            $ref = $this->accountingService->createJournalEntry(
                $request->entries, $request->description, $admin?->id
            );
            return response()->json(['success' => true, 'journal_ref' => $ref], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function summary(Request $request)
    {
        return response()->json($this->accountingService->getFinancialSummary($request->from, $request->to));
    }

    public function accountBalances()
    {
        return response()->json($this->accountingService->getAccountBalances());
    }

    public function profitLoss(Request $request)
    {
        return response()->json($this->accountingService->getProfitLoss($request->from, $request->to));
    }

    public function balanceSheet(Request $request)
    {
        return response()->json($this->accountingService->getBalanceSheet($request->as_of));
    }

    public function trialBalance(Request $request)
    {
        return response()->json($this->accountingService->getTrialBalance($request->from, $request->to));
    }

    public function cashFlow(Request $request)
    {
        return response()->json($this->accountingService->getCashFlow($request->from, $request->to));
    }

    public function daybook(Request $request)
    {
        return response()->json($this->accountingService->getDaybook($request->get('date', now()->toDateString())));
    }

    public function ledgerStatement(Request $request)
    {
        $request->validate(['account_id' => 'required|uuid|exists:accounts,id']);
        return response()->json($this->accountingService->getLedgerStatement($request->account_id, $request->from, $request->to));
    }

    public function receivablePayable()
    {
        return response()->json($this->accountingService->getReceivablePayable());
    }

    public function equityChanges(Request $request)
    {
        return response()->json($this->accountingService->getEquityChanges($request->from, $request->to));
    }

    public function chequeRegister(Request $request)
    {
        return response()->json($this->accountingService->getChequeRegister($request->from, $request->to));
    }

    public function allLedgers()
    {
        return response()->json($this->accountingService->getAllLedgers());
    }
}

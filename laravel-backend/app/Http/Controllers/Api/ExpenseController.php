<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\AccountingService;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function __construct(protected AccountingService $accountingService) {}

    public function index(Request $request)
    {
        $query = Expense::with(['account', 'vendor', 'createdBy', 'approvedBy']);

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('from') && $request->has('to')) {
            $query->whereBetween('expense_date', [$request->from, $request->to]);
        }

        return response()->json(
            $query->orderBy('expense_date', 'desc')->paginate($request->get('per_page', 50))
        );
    }

    public function show(string $id)
    {
        return response()->json(
            Expense::with(['account', 'vendor', 'createdBy', 'approvedBy'])->findOrFail($id)
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'category'       => 'required|string|max:100',
            'amount'         => 'required|numeric|min:0.01',
            'expense_date'   => 'required|date',
            'description'    => 'nullable|string|max:500',
            'payment_method' => 'nullable|string|max:50',
            'account_id'     => 'nullable|uuid|exists:accounts,id',
            'vendor_id'      => 'nullable|uuid|exists:vendors,id',
        ]);

        $admin = $request->get('admin_user');

        // Generate expense number
        $last = Expense::orderBy('created_at', 'desc')->first();
        $number = 'EXP-000001';
        if ($last && preg_match('/EXP-(\d+)/', $last->expense_number, $m)) {
            $number = 'EXP-' . str_pad((int) $m[1] + 1, 6, '0', STR_PAD_LEFT);
        }

        $expense = Expense::create([
            'expense_number' => $number,
            'category'       => $request->category,
            'amount'         => $request->amount,
            'expense_date'   => $request->expense_date,
            'description'    => $request->description,
            'payment_method' => $request->payment_method,
            'account_id'     => $request->account_id,
            'vendor_id'      => $request->vendor_id,
            'receipt_url'    => $request->receipt_url,
            'status'         => 'approved',
            'created_by'     => $admin?->id,
            'approved_by'    => $admin?->id,
        ]);

        // Auto-record transaction
        $this->accountingService->recordExpense([
            'category'       => $request->category,
            'amount'         => $request->amount,
            'date'           => $request->expense_date,
            'description'    => "Expense {$number}: {$request->description}",
            'reference_type' => 'expense',
            'reference_id'   => $expense->id,
            'account_id'     => $request->account_id,
            'vendor_id'      => $request->vendor_id,
            'created_by'     => $admin?->id,
        ]);

        return response()->json($expense->load('account', 'vendor'), 201);
    }

    public function update(Request $request, string $id)
    {
        $expense = Expense::findOrFail($id);
        $expense->update($request->only([
            'category', 'amount', 'expense_date', 'description',
            'payment_method', 'account_id', 'vendor_id',
            'receipt_url', 'status',
        ]));

        return response()->json($expense->fresh());
    }

    public function destroy(string $id)
    {
        $expense = Expense::findOrFail($id);
        $expense->delete();
        return response()->json(['success' => true]);
    }

    /**
     * GET /api/expenses/summary
     */
    public function summary(Request $request)
    {
        $from = $request->from ?? now()->startOfMonth()->toDateString();
        $to   = $request->to ?? now()->endOfMonth()->toDateString();

        $expenses = Expense::where('status', 'approved')
            ->whereBetween('expense_date', [$from, $to]);

        $byCategory = (clone $expenses)
            ->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')
            ->get();

        return response()->json([
            'from'            => $from,
            'to'              => $to,
            'total_expense'   => (float) (clone $expenses)->sum('amount'),
            'total_count'     => (clone $expenses)->count(),
            'by_category'     => $byCategory,
        ]);
    }
}

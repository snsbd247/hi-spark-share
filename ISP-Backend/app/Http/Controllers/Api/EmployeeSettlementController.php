<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAccount;
use App\Models\EmployeeSettlement;
use App\Services\EmployeeSettlementService;
use Illuminate\Http\Request;

class EmployeeSettlementController extends Controller
{
    public function __construct(protected EmployeeSettlementService $service) {}

    public function index(Request $request)
    {
        $q = EmployeeSettlement::with('employee:id,employee_id,name,designation_id');
        if ($request->filled('employee_id')) $q->where('employee_id', $request->employee_id);
        if ($request->filled('status'))      $q->where('status', $request->status);
        if ($request->filled('month'))       $q->where('month', $request->month);
        return response()->json($q->orderByDesc('created_at')->paginate($request->get('per_page', 25)));
    }

    public function show(string $id)
    {
        $s = EmployeeSettlement::with(['employee', 'entries'])->findOrFail($id);
        return response()->json($s);
    }

    public function generate(Request $request)
    {
        $request->validate([
            'employee_id'      => 'required|uuid|exists:employees,id',
            'month'            => 'nullable|string',
            'salary_sheet_id'  => 'nullable|uuid',
        ]);

        $s = $this->service->generate($request->employee_id, $request->month, $request->salary_sheet_id);
        return response()->json(['success' => true, 'settlement' => $s], 201);
    }

    public function settle(Request $request, string $id)
    {
        $admin = $request->get('admin_user');
        try {
            $s = $this->service->settle($id, [
                'cash_account_id' => $request->cash_account_id,
                'payment_method'  => $request->payment_method ?? 'cash',
                'created_by'      => $admin?->id,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
        return response()->json(['success' => true, 'settlement' => $s]);
    }

    public function ledger(Request $request)
    {
        $request->validate(['employee_id' => 'required|uuid|exists:employees,id']);
        return response()->json($this->service->getLedger($request->employee_id, $request->from, $request->to));
    }

    public function entries(Request $request)
    {
        $q = EmployeeAccount::with('employee:id,employee_id,name');
        if ($request->filled('employee_id')) $q->where('employee_id', $request->employee_id);
        if ($request->filled('type'))        $q->where('type', $request->type);
        return response()->json($q->orderByDesc('date')->paginate($request->get('per_page', 50)));
    }

    public function storeEntry(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|uuid|exists:employees,id',
            'type'        => 'required|in:advance,bonus,deduction',
            'amount'      => 'required|numeric|min:0.01',
            'date'        => 'nullable|date',
            'description' => 'nullable|string|max:500',
        ]);

        $admin = $request->get('admin_user');
        $entry = $this->service->recordEntry(array_merge($request->all(), ['created_by' => $admin?->id]));
        return response()->json(['success' => true, 'entry' => $entry], 201);
    }
}

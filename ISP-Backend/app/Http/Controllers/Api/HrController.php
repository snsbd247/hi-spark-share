<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Attendance;
use App\Models\Loan;
use App\Models\SalarySheet;
use App\Models\EmployeeSalaryStructure;
use Illuminate\Http\Request;

class HrController extends Controller
{
    // ── Designations ─────────────────────────────────────

    public function designations(Request $request)
    {
        $query = Designation::query()->orderBy('name');
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        return response()->json($query->get());
    }

    public function storeDesignation(Request $request)
    {
        $request->validate(['name' => 'required|string|max:255']);
        $designation = Designation::create($request->only('name', 'description', 'status'));
        return response()->json($designation, 201);
    }

    public function updateDesignation(Request $request, string $id)
    {
        $designation = Designation::findOrFail($id);
        $designation->update($request->only('name', 'description', 'status'));
        return response()->json($designation);
    }

    public function deleteDesignation(string $id)
    {
        Designation::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Employees ────────────────────────────────────────

    public function employees(Request $request)
    {
        $query = Employee::with('designation')->orderBy('name');
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%$s%")
                  ->orWhere('employee_id', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%");
            });
        }
        return response()->json($query->get());
    }

    public function storeEmployee(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|string|unique:employees,employee_id',
            'name'        => 'required|string|max:255',
        ]);
        $employee = Employee::create($request->all());
        return response()->json($employee->load('designation'), 201);
    }

    public function updateEmployee(Request $request, string $id)
    {
        $employee = Employee::findOrFail($id);
        $employee->update($request->all());
        return response()->json($employee->load('designation'));
    }

    public function deleteEmployee(string $id)
    {
        Employee::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * GET /api/hr/employees/{id}
     * Full employee profile with all related data.
     */
    public function employeeProfile(string $id)
    {
        $employee = Employee::with([
            'designation',
            'salaryStructure',
            'allSalaryStructures',
            'education',
            'experience',
            'emergencyContacts',
            'providentFund',
            'savingsFund',
            'loans',
        ])->findOrFail($id);

        return response()->json($employee);
    }

    // ── Attendance ────────────────────────────────────────

    public function dailyAttendance(Request $request)
    {
        $date = $request->get('date', now()->toDateString());
        $attendances = Attendance::with('employee.designation')
            ->where('date', $date)
            ->get();
        return response()->json($attendances);
    }

    public function monthlyAttendance(Request $request)
    {
        $month = $request->get('month', now()->format('Y-m'));
        $attendances = Attendance::with('employee')
            ->where('date', 'like', "$month%")
            ->orderBy('date')
            ->get();

        $grouped = $attendances->groupBy('employee_id')->map(function ($records) {
            $employee = $records->first()->employee;
            return [
                'employee'  => $employee,
                'present'   => $records->where('status', 'present')->count(),
                'absent'    => $records->where('status', 'absent')->count(),
                'late'      => $records->where('status', 'late')->count(),
                'leave'     => $records->where('status', 'leave')->count(),
                'total'     => $records->count(),
            ];
        });

        return response()->json($grouped->values());
    }

    public function storeAttendance(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|uuid|exists:employees,id',
            'date'        => 'required|date',
            'status'      => 'required|in:present,absent,late,leave',
        ]);

        $attendance = Attendance::updateOrCreate(
            ['employee_id' => $request->employee_id, 'date' => $request->date],
            $request->only('status', 'check_in', 'check_out', 'notes')
        );

        return response()->json($attendance->load('employee'), 201);
    }

    public function bulkAttendance(Request $request)
    {
        $request->validate([
            'date'        => 'required|date',
            'records'     => 'required|array',
            'records.*.employee_id' => 'required|uuid',
            'records.*.status'      => 'required|in:present,absent,late,leave',
        ]);

        foreach ($request->records as $record) {
            Attendance::updateOrCreate(
                ['employee_id' => $record['employee_id'], 'date' => $request->date],
                [
                    'status'    => $record['status'],
                    'check_in'  => $record['check_in'] ?? null,
                    'check_out' => $record['check_out'] ?? null,
                    'notes'     => $record['notes'] ?? null,
                ]
            );
        }

        return response()->json(['message' => 'Attendance saved']);
    }

    // ── Loans ────────────────────────────────────────────

    public function loans(Request $request)
    {
        $query = Loan::with('employee')->orderByDesc('created_at');
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }
        return response()->json($query->get());
    }

    public function storeLoan(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|uuid|exists:employees,id',
            'amount'      => 'required|numeric|min:1',
        ]);
        $loan = Loan::create($request->all());
        return response()->json($loan->load('employee'), 201);
    }

    public function updateLoan(Request $request, string $id)
    {
        $loan = Loan::findOrFail($id);
        $loan->update($request->all());
        return response()->json($loan->load('employee'));
    }

    public function deleteLoan(string $id)
    {
        Loan::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Salary Sheet ─────────────────────────────────────

    public function salarySheets(Request $request)
    {
        $month = $request->get('month', now()->format('Y-m'));
        $sheets = SalarySheet::with('employee.designation')
            ->where('month', $month)
            ->get();
        return response()->json($sheets);
    }

    public function generateSalary(Request $request)
    {
        $request->validate(['month' => 'required|string']);
        $month = $request->month;

        $employees = Employee::where('status', 'active')->get();
        $generated = 0;

        foreach ($employees as $emp) {
            // Get salary structure if available
            $structure = EmployeeSalaryStructure::where('employee_id', $emp->id)
                ->orderByDesc('effective_from')
                ->first();

            $basicSalary = $structure ? $structure->basic_salary : $emp->salary;
            $houseRent = $structure ? $structure->house_rent : 0;
            $medical = $structure ? $structure->medical : 0;
            $conveyance = $structure ? $structure->conveyance : 0;
            $otherAllowance = $structure ? $structure->other_allowance : 0;

            $grossSalary = $basicSalary + $houseRent + $medical + $conveyance + $otherAllowance;

            // Loan deductions (all active loans)
            $loanDeduction = Loan::where('employee_id', $emp->id)
                ->where('status', 'active')
                ->sum('monthly_deduction');

            $payload = [
                'employee_id'     => $emp->id,
                'month'           => $month,
                'basic_salary'    => $basicSalary,
                'house_rent'      => $houseRent,
                'medical'         => $medical,
                'conveyance'      => $conveyance,
                'other_allowance' => $otherAllowance,
                'bonus'           => 0,
                'deduction'       => 0,
                'loan_deduction'  => $loanDeduction,
                'pf_deduction'    => 0,
                'savings_deduction' => 0,
                'net_salary'      => $grossSalary - $loanDeduction,
                'status'          => 'pending',
            ];

            // Upsert — update if already exists for this month
            $existing = SalarySheet::where('employee_id', $emp->id)
                ->where('month', $month)
                ->first();

            if ($existing) {
                $existing->update($payload);
            } else {
                SalarySheet::create($payload);
                $generated++;
            }
        }

        return response()->json([
            'message' => $generated > 0
                ? "$generated salary sheets generated"
                : "All salary sheets regenerated from salary structure",
        ]);
    }

    public function updateSalarySheet(Request $request, string $id)
    {
        $sheet = SalarySheet::findOrFail($id);
        $sheet->update($request->all());

        // Recalculate net salary
        $gross = $sheet->basic_salary + $sheet->house_rent + $sheet->medical
            + $sheet->conveyance + $sheet->other_allowance + $sheet->bonus;
        $deductions = $sheet->deduction + $sheet->loan_deduction
            + $sheet->pf_deduction + $sheet->savings_deduction;
        $sheet->net_salary = $gross - $deductions;
        $sheet->save();

        return response()->json($sheet->load('employee'));
    }

    public function paySalary(Request $request, string $id)
    {
        $sheet = SalarySheet::findOrFail($id);
        $sheet->update([
            'status'         => 'paid',
            'paid_date'      => now()->toDateString(),
            'payment_method' => $request->get('payment_method', 'cash'),
        ]);

        // Update all active loans for this employee
        $activeLoans = Loan::where('employee_id', $sheet->employee_id)
            ->where('status', 'active')
            ->get();

        foreach ($activeLoans as $loan) {
            $loan->paid_amount += $loan->monthly_deduction;
            if ($loan->paid_amount >= $loan->amount) {
                $loan->status = 'paid';
            }
            $loan->save();
        }

        return response()->json($sheet->load('employee'));
    }
}

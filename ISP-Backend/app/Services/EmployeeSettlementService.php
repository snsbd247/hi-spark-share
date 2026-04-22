<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Employee;
use App\Models\EmployeeAccount;
use App\Models\EmployeeSettlement;
use App\Models\SalarySheet;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * EmployeeSettlementService — sits ON TOP of existing SalarySheet/Payroll.
 * Computes settlement from SalarySheet + EmployeeAccount entries (advance, bonus, deduction)
 * and posts strict double-entry journal entries through AccountingService.
 *
 * Existing payroll, attendance and salary modules are NOT modified.
 */
class EmployeeSettlementService
{
    public function __construct(protected AccountingService $accounting) {}

    public const ACC_SALARY_EXPENSE     = '5002';
    public const ACC_EMPLOYEE_PAYABLE   = '2003A';
    public const ACC_EMPLOYEE_ADVANCE   = '1012';   // Asset (receivable from employee)
    public const ACC_BONUS_EXPENSE      = '5002';   // Bonus rolls into Salary & Wages by default
    public const ACC_CASH               = '1001';

    /**
     * Ensure default Settlement-related COA accounts exist for the tenant.
     */
    public function ensureSettlementAccounts(?string $tenantId = null): void
    {
        $tenantId = $tenantId ?? (function_exists('tenant_id') ? tenant_id() : null);

        $this->accounting->ensureAccount([
            'code' => self::ACC_EMPLOYEE_ADVANCE,
            'name' => 'Employee Advance / Receivable',
            'type' => 'asset',
            'level' => 1,
        ], $tenantId);

        $this->accounting->ensureAccount([
            'code' => self::ACC_EMPLOYEE_PAYABLE,
            'name' => 'Salary Payable',
            'type' => 'liability',
            'level' => 2,
        ], $tenantId);
    }

    protected function tenantSetting(string $key, ?string $tenantId = null): ?string
    {
        $tenantId = $tenantId ?? (function_exists('tenant_id') ? tenant_id() : null);
        $row = SystemSetting::where('setting_key', $key)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->first();
        return $row?->setting_value;
    }

    /**
     * Record a one-off employee transaction (advance, bonus, deduction).
     * advance:    Dr Employee Advance, Cr Cash
     * bonus:      Dr Bonus/Salary Expense, Cr Employee Payable
     * deduction:  No JE here — applied at settlement (reduces net payable)
     */
    public function recordEntry(array $data): EmployeeAccount
    {
        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        $this->ensureSettlementAccounts($tenantId);

        $type = $data['type'];
        if (!in_array($type, ['advance', 'bonus', 'deduction', 'salary'])) {
            throw new RuntimeException('Invalid employee account type.');
        }

        return DB::transaction(function () use ($data, $type, $tenantId) {
            $coaAccount = null;
            $journalRef = null;
            $amount = (float) $data['amount'];

            if ($type === 'advance') {
                $advanceAcct = $this->accounting->accountByCode(self::ACC_EMPLOYEE_ADVANCE, $tenantId);
                $cashId      = $data['cash_account_id'] ?? $this->tenantSetting('salary_cash_account', $tenantId);
                $cashAcct    = $cashId ? Account::find($cashId) : $this->accounting->accountByCode(self::ACC_CASH, $tenantId);
                if ($advanceAcct && $cashAcct) {
                    $journalRef = $this->accounting->createJournalEntry([
                        ['account_id' => $advanceAcct->id, 'debit' => $amount, 'credit' => 0,
                         'description' => 'Employee advance — '.($data['description'] ?? '')],
                        ['account_id' => $cashAcct->id, 'debit' => 0, 'credit' => $amount,
                         'description' => 'Cash paid as advance'],
                    ], 'Employee Advance', $data['created_by'] ?? null);
                    $coaAccount = $advanceAcct->id;
                }
            } elseif ($type === 'bonus') {
                $expense = $this->accounting->accountByCode(self::ACC_BONUS_EXPENSE, $tenantId);
                $payable = $this->accounting->accountByCode(self::ACC_EMPLOYEE_PAYABLE, $tenantId);
                if ($expense && $payable) {
                    $journalRef = $this->accounting->createJournalEntry([
                        ['account_id' => $expense->id, 'debit' => $amount, 'credit' => 0,
                         'description' => 'Bonus expense'],
                        ['account_id' => $payable->id, 'debit' => 0, 'credit' => $amount,
                         'description' => 'Bonus payable to employee'],
                    ], 'Employee Bonus', $data['created_by'] ?? null);
                    $coaAccount = $expense->id;
                }
            }

            return EmployeeAccount::create([
                'tenant_id'      => $tenantId,
                'employee_id'    => $data['employee_id'],
                'type'           => $type,
                'amount'         => $amount,
                'coa_account_id' => $coaAccount,
                'reference'      => $data['reference'] ?? null,
                'date'           => $data['date'] ?? now()->toDateString(),
                'description'    => $data['description'] ?? null,
                'journal_ref'    => $journalRef,
                'created_by'     => $data['created_by'] ?? null,
            ]);
        });
    }

    /**
     * Generate a settlement record from a SalarySheet (or live calculation if month given).
     * Does NOT post the salary expense JE — that happens in settle().
     */
    public function generate(string $employeeId, ?string $month = null, ?string $salarySheetId = null): EmployeeSettlement
    {
        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        $employee = Employee::findOrFail($employeeId);

        $sheet = null;
        if ($salarySheetId) {
            $sheet = SalarySheet::find($salarySheetId);
        } elseif ($month) {
            $sheet = SalarySheet::where('employee_id', $employeeId)->where('month', $month)->latest()->first();
        }

        $earn       = 0.0;
        $deduction  = 0.0;
        $resolvedMonth = $month;

        if ($sheet) {
            $earn = (float) $sheet->basic_salary + (float) $sheet->house_rent + (float) $sheet->medical
                  + (float) $sheet->conveyance + (float) $sheet->other_allowance + (float) $sheet->bonus;
            $deduction = (float) $sheet->deduction + (float) $sheet->loan_deduction
                       + (float) $sheet->pf_deduction + (float) $sheet->savings_deduction;
            $resolvedMonth = $sheet->month;
        } else {
            $earn = (float) ($employee->salary ?? 0);
        }

        // Pull adjustment entries: bonus adds to earn, advance & deduction subtract
        $entries = EmployeeAccount::where('employee_id', $employeeId)
            ->whereNull('settlement_id')
            ->when($month, function ($q) use ($month) {
                $q->whereBetween('date', [$month.'-01', date('Y-m-t', strtotime($month.'-01'))]);
            })
            ->get();

        foreach ($entries as $e) {
            if ($e->type === 'bonus')         $earn += (float) $e->amount;
            elseif ($e->type === 'advance')   $deduction += (float) $e->amount;
            elseif ($e->type === 'deduction') $deduction += (float) $e->amount;
        }

        $netPayable = round($earn - $deduction, 2);

        $settlement = EmployeeSettlement::create([
            'tenant_id'       => $tenantId,
            'employee_id'     => $employeeId,
            'salary_sheet_id' => $sheet?->id,
            'month'           => $resolvedMonth,
            'total_earn'      => $earn,
            'total_deduction' => $deduction,
            'net_payable'     => max(0, $netPayable),
            'status'          => 'pending',
        ]);

        // Link unattached entries to this settlement so we don't double-count next time
        EmployeeAccount::whereIn('id', $entries->pluck('id'))->update(['settlement_id' => $settlement->id]);

        return $settlement;
    }

    /**
     * Settle (pay) an employee. Posts:
     *   1. Dr Salary Expense        Cr Employee Payable   (gross salary accrual, if not done before)
     *   2. Dr Employee Payable      Cr Cash/Bank          (net payment)
     *   3. Dr Employee Payable      Cr Employee Advance   (advance settlement, if any)
     */
    public function settle(string $settlementId, array $opts = []): EmployeeSettlement
    {
        $tenantId = function_exists('tenant_id') ? tenant_id() : null;
        $this->ensureSettlementAccounts($tenantId);

        return DB::transaction(function () use ($settlementId, $opts, $tenantId) {
            /** @var EmployeeSettlement $settlement */
            $settlement = EmployeeSettlement::lockForUpdate()->findOrFail($settlementId);

            if ($settlement->status === 'paid') {
                throw new RuntimeException('Settlement is already paid.');
            }

            $expense  = $this->accounting->accountByCode(self::ACC_SALARY_EXPENSE, $tenantId);
            $payable  = $this->accounting->accountByCode(self::ACC_EMPLOYEE_PAYABLE, $tenantId);
            $advance  = $this->accounting->accountByCode(self::ACC_EMPLOYEE_ADVANCE, $tenantId);
            $cashId   = $opts['cash_account_id'] ?? $this->tenantSetting('salary_cash_account', $tenantId);
            $cash     = $cashId ? Account::find($cashId) : $this->accounting->accountByCode(self::ACC_CASH, $tenantId);

            if (!$expense || !$payable || !$cash) {
                throw new RuntimeException('Required COA accounts (Salary Expense / Employee Payable / Cash) not configured.');
            }

            $earn        = (float) $settlement->total_earn;
            $netPayable  = (float) $settlement->net_payable;
            $advanceUsed = (float) EmployeeAccount::where('settlement_id', $settlement->id)
                                                  ->where('type', 'advance')->sum('amount');

            // 1) Salary accrual: Dr Salary Expense, Cr Employee Payable
            $entries = [
                ['account_id' => $expense->id, 'debit' => $earn, 'credit' => 0,
                 'description' => 'Salary expense — '.($settlement->month ?? '')],
                ['account_id' => $payable->id, 'debit' => 0, 'credit' => $earn,
                 'description' => 'Salary payable accrual'],
            ];

            // 2) Cash payment: Dr Payable, Cr Cash
            if ($netPayable > 0) {
                $entries[] = ['account_id' => $payable->id, 'debit' => $netPayable, 'credit' => 0,
                              'description' => 'Salary paid to employee'];
                $entries[] = ['account_id' => $cash->id, 'debit' => 0, 'credit' => $netPayable,
                              'description' => 'Cash/Bank outflow'];
            }

            // 3) Advance settlement: Dr Payable, Cr Employee Advance
            if ($advanceUsed > 0 && $advance) {
                $entries[] = ['account_id' => $payable->id, 'debit' => $advanceUsed, 'credit' => 0,
                              'description' => 'Advance adjusted'];
                $entries[] = ['account_id' => $advance->id, 'debit' => 0, 'credit' => $advanceUsed,
                              'description' => 'Advance recovered'];
            }

            $journalRef = $this->accounting->createJournalEntry(
                $entries,
                'Employee Settlement #'.$settlement->id,
                $opts['created_by'] ?? null
            );

            // Persist a final EmployeeAccount entry for traceability
            EmployeeAccount::create([
                'tenant_id'      => $tenantId,
                'employee_id'    => $settlement->employee_id,
                'type'           => 'settlement_payment',
                'amount'         => $netPayable,
                'coa_account_id' => $cash->id,
                'reference'      => 'Settlement '.$settlement->id,
                'settlement_id'  => $settlement->id,
                'salary_sheet_id'=> $settlement->salary_sheet_id,
                'journal_ref'    => $journalRef,
                'date'           => now()->toDateString(),
                'description'    => 'Settlement payment',
                'created_by'     => $opts['created_by'] ?? null,
            ]);

            $settlement->update([
                'status'               => 'paid',
                'payment_method'       => $opts['payment_method'] ?? 'cash',
                'paid_from_account_id' => $cash->id,
                'journal_ref'          => $journalRef,
                'settled_at'           => now(),
            ]);

            // Mirror to existing SalarySheet so legacy HR module reflects payment
            if ($settlement->salary_sheet_id) {
                SalarySheet::where('id', $settlement->salary_sheet_id)
                    ->update(['status' => 'paid', 'paid_date' => now()->toDateString()]);
            }

            return $settlement->fresh();
        });
    }

    /**
     * Per-employee ledger of earnings, advances, bonuses, deductions, and settlements.
     */
    public function getLedger(string $employeeId, ?string $from = null, ?string $to = null): array
    {
        $q = EmployeeAccount::where('employee_id', $employeeId);
        if ($from) $q->where('date', '>=', $from);
        if ($to)   $q->where('date', '<=', $to);

        $entries = $q->orderBy('date')->orderBy('created_at')->get();

        $running = 0.0;
        $rows = $entries->map(function ($e) use (&$running) {
            $delta = in_array($e->type, ['salary', 'bonus', 'settlement_payment'])
                ? (float) $e->amount
                : -(float) $e->amount;
            $running += $delta;
            return [
                'id' => $e->id, 'date' => optional($e->date)->format('Y-m-d'),
                'type' => $e->type, 'amount' => (float) $e->amount,
                'description' => $e->description, 'reference' => $e->reference,
                'journal_ref' => $e->journal_ref, 'running_balance' => round($running, 2),
            ];
        });

        return [
            'employee_id'    => $employeeId,
            'from'           => $from, 'to' => $to,
            'entries'        => $rows->toArray(),
            'closing_balance'=> round($running, 2),
            'totals' => [
                'salary'     => (float) $entries->where('type', 'salary')->sum('amount'),
                'bonus'      => (float) $entries->where('type', 'bonus')->sum('amount'),
                'advance'    => (float) $entries->where('type', 'advance')->sum('amount'),
                'deduction'  => (float) $entries->where('type', 'deduction')->sum('amount'),
                'paid'       => (float) $entries->where('type', 'settlement_payment')->sum('amount'),
            ],
        ];
    }
}

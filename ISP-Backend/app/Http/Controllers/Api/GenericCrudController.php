<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class GenericCrudController extends Controller
{
    protected array $tableModelMap = [
        'profiles' => \App\Models\Profile::class,
        'customers' => \App\Models\Customer::class,
        'bills' => \App\Models\Bill::class,
        'payments' => \App\Models\Payment::class,
        'packages' => \App\Models\Package::class,
        'customer_ledger' => \App\Models\CustomerLedger::class,
        'customer_sessions' => \App\Models\CustomerSession::class,
        'merchant_payments' => \App\Models\MerchantPayment::class,
        'mikrotik_routers' => \App\Models\MikrotikRouter::class,
        'support_tickets' => \App\Models\SupportTicket::class,
        'ticket_replies' => \App\Models\TicketReply::class,
        'sms_settings' => \App\Models\SmsSetting::class,
        'sms_templates' => \App\Models\SmsTemplate::class,
        'sms_logs' => \App\Models\SmsLog::class,
        'reminder_logs' => \App\Models\ReminderLog::class,
        'audit_logs' => \App\Models\AuditLog::class,
        'general_settings' => \App\Models\GeneralSetting::class,
        'system_settings' => \App\Models\SystemSetting::class,
        'payment_gateways' => \App\Models\PaymentGateway::class,
        'backup_logs' => \App\Models\BackupLog::class,
        'zones' => \App\Models\Zone::class,
        'olts' => \App\Models\Olt::class,
        'onus' => \App\Models\Onu::class,
        'custom_roles' => \App\Models\CustomRole::class,
        'user_roles' => \App\Models\UserRole::class,
        'permissions' => \App\Models\Permission::class,
        'role_permissions' => \App\Models\RolePermission::class,
        'admin_sessions' => \App\Models\AdminSession::class,
        'admin_login_logs' => \App\Models\AdminLoginLog::class,
        // Accounting & Inventory
        'vendors' => \App\Models\Vendor::class,
        'products' => \App\Models\Product::class,
        'accounts' => \App\Models\Account::class,
        'transactions' => \App\Models\Transaction::class,
        'purchases' => \App\Models\Purchase::class,
        'purchase_items' => \App\Models\PurchaseItem::class,
        'sales' => \App\Models\Sale::class,
        'sale_items' => \App\Models\SaleItem::class,
        'expenses' => \App\Models\Expense::class,
        'daily_reports' => \App\Models\DailyReport::class,
        // HR
        'designations' => \App\Models\Designation::class,
        'employees' => \App\Models\Employee::class,
        'attendance' => \App\Models\Attendance::class,
        'attendances' => \App\Models\Attendance::class,
        'loans' => \App\Models\Loan::class,
        'salary_sheets' => \App\Models\SalarySheet::class,
        // Supplier
        'suppliers' => \App\Models\Supplier::class,
        'supplier_payments' => \App\Models\SupplierPayment::class,
        // Accounting Heads
        'income_heads' => \App\Models\IncomeHead::class,
        'expense_heads' => \App\Models\ExpenseHead::class,
        'other_heads' => \App\Models\OtherHead::class,
        // Employee Profile
        'employee_salary_structure' => \App\Models\EmployeeSalaryStructure::class,
        'employee_education' => \App\Models\EmployeeEducation::class,
        'employee_experience' => \App\Models\EmployeeExperience::class,
        'employee_emergency_contacts' => \App\Models\EmployeeEmergencyContact::class,
        'employee_provident_fund' => \App\Models\EmployeeProvidentFund::class,
        'employee_savings_fund' => \App\Models\EmployeeSavingsFund::class,
        // Geo Location
        'geo_divisions' => \App\Models\GeoDivision::class,
        'geo_districts' => \App\Models\GeoDistrict::class,
        'geo_upazilas' => \App\Models\GeoUpazila::class,
    ];

    protected function getModel(string $table)
    {
        $modelClass = $this->tableModelMap[$table] ?? null;
        if (!$modelClass) {
            abort(404, "Table '{$table}' not found");
        }
        return new $modelClass;
    }

    public function index(Request $request, string $table)
    {
        $model = $this->getModel($table);
        $query = $model->newQuery();

        // Support filtering: ?column=value
        foreach ($request->except(['page', 'per_page', 'order', 'order_by', 'select', 'search', 'limit', 'with']) as $key => $value) {
            if (in_array($key, $model->getFillable())) {
                if ($value === 'null') {
                    $query->whereNull($key);
                } elseif (str_starts_with($value, 'not:')) {
                    $query->where($key, '!=', substr($value, 4));
                } elseif (str_starts_with($value, 'gte:')) {
                    $query->where($key, '>=', substr($value, 4));
                } elseif (str_starts_with($value, 'lte:')) {
                    $query->where($key, '<=', substr($value, 4));
                } elseif (str_starts_with($value, 'like:')) {
                    $query->where($key, 'like', '%' . substr($value, 5) . '%');
                } elseif (str_contains($value, ',')) {
                    $query->whereIn($key, explode(',', $value));
                } else {
                    $query->where($key, $value);
                }
            }
        }

        // Support ordering
        $orderBy = $request->get('order_by', 'created_at');
        $order = $request->get('order', 'desc');
        $query->orderBy($orderBy, $order);

        // Support select
        if ($request->has('select')) {
            $columns = explode(',', $request->get('select'));
            $query->select($columns);
        }

        // Support eager loading
        if ($request->has('with')) {
            $relations = explode(',', $request->get('with'));
            $query->with($relations);
        }

        // Support search
        if ($request->has('search') && method_exists($model, 'getFillable')) {
            $search = $request->get('search');
            $searchable = array_intersect($model->getFillable(), [
                'name', 'phone', 'email', 'customer_id', 'area', 'subject',
                'ticket_id', 'employee_id', 'full_name', 'username', 'mobile',
                'transaction_id', 'sender_phone', 'description', 'reference',
            ]);
            if (!empty($searchable)) {
                $query->where(function ($q) use ($searchable, $search) {
                    foreach ($searchable as $col) {
                        $q->orWhere($col, 'like', "%{$search}%");
                    }
                });
            }
        }

        $limit = $request->get('limit');
        if ($limit) {
            return response()->json($query->limit((int)$limit)->get());
        }

        $perPage = $request->get('per_page', 50);
        return response()->json($query->paginate($perPage));
    }

    public function show(Request $request, string $table, string $id)
    {
        $model = $this->getModel($table);
        $query = $model->newQuery();

        if ($request->has('with')) {
            $relations = explode(',', $request->get('with'));
            $query->with($relations);
        }

        $record = $query->findOrFail($id);
        return response()->json($record);
    }

    public function store(Request $request, string $table)
    {
        $model = $this->getModel($table);
        $record = $model->create($request->all());
        return response()->json($record, 201);
    }

    public function update(Request $request, string $table, string $id)
    {
        $model = $this->getModel($table);
        $record = $model->findOrFail($id);
        $record->update($request->all());
        return response()->json($record);
    }

    public function destroy(Request $request, string $table, string $id)
    {
        $model = $this->getModel($table);
        $record = $model->findOrFail($id);
        $record->delete();
        return response()->json(['success' => true]);
    }
}

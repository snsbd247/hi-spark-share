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
        foreach ($request->except(['page', 'per_page', 'order', 'order_by', 'select', 'search', 'limit']) as $key => $value) {
            if (in_array($key, $model->getFillable())) {
                $query->where($key, $value);
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

        // Support search
        if ($request->has('search') && method_exists($model, 'getFillable')) {
            $search = $request->get('search');
            $searchable = array_intersect($model->getFillable(), ['name', 'phone', 'email', 'customer_id', 'area', 'subject', 'ticket_id']);
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
        $record = $model->findOrFail($id);
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

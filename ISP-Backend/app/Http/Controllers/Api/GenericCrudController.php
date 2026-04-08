<?php

namespace App\Http\Controllers\Api;

use App\Models\Account;
use App\Models\Expense;
use App\Models\PaymentGateway;
use App\Models\Transaction;
use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class GenericCrudController extends Controller
{
    protected array $tableModelMap = [
        'users' => \App\Models\User::class,
        'profiles' => \App\Models\User::class,
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
        // Multi-tenancy
        'tenants' => \App\Models\Tenant::class,
        'domains' => \App\Models\Domain::class,
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
        // New modules
        'notifications' => \App\Models\Notification::class,
        'coupons' => \App\Models\Coupon::class,
        'ip_pools' => \App\Models\IpPool::class,
        'faqs' => \App\Models\Faq::class,
        'activity_logs' => \App\Models\ActivityLog::class,
        'login_histories' => \App\Models\LoginHistory::class,
        'modules' => \App\Models\Module::class,
        'online_sessions' => \App\Models\Onu::class,
        'billing_config' => \App\Models\SystemSetting::class,
        'sms_wallets' => \App\Models\SmsWallet::class,
        'sms_transactions' => \App\Models\SmsTransaction::class,
        'network_nodes' => \App\Models\NetworkNode::class,
        'network_links' => \App\Models\NetworkLink::class,
        // Fiber Topology
        'fiber_olts' => \App\Models\FiberOlt::class,
        'fiber_pon_ports' => \App\Models\FiberPonPort::class,
        'fiber_cables' => \App\Models\FiberCable::class,
        'fiber_cores' => \App\Models\FiberCore::class,
        'fiber_splitters' => \App\Models\FiberSplitter::class,
        'fiber_splitter_outputs' => \App\Models\FiberSplitterOutput::class,
        'fiber_onus' => \App\Models\FiberOnu::class,
        // SaaS
        'saas_plans' => \App\Models\SaasPlan::class,
        'subscriptions' => \App\Models\Subscription::class,
        'subscription_invoices' => \App\Models\SubscriptionInvoice::class,
        'impersonations' => \App\Models\Impersonation::class,
        'plan_modules' => \App\Models\PlanModule::class,
        // Reseller
        'resellers' => \App\Models\Reseller::class,
        'reseller_wallet_transactions' => \App\Models\ResellerWalletTransaction::class,
        'reseller_package_commissions' => \App\Models\ResellerPackageCommission::class,
        'reseller_packages' => \App\Models\ResellerPackage::class,
        'reseller_sessions' => \App\Models\ResellerSession::class,
        'reseller_commissions' => \App\Models\ResellerCommission::class,
        'reseller_zones' => \App\Models\ResellerZone::class,
        // Customer extras
        'customer_devices' => \App\Models\CustomerDevice::class,
        'customer_bandwidth_usages' => \App\Models\CustomerBandwidthUsage::class,
        'customer_reseller_migrations' => \App\Models\CustomerResellerMigration::class,
        // Inventory extras
        'product_serials' => \App\Models\ProductSerial::class,
        'inventory_logs' => \App\Models\InventoryLog::class,
        'categories' => \App\Models\Category::class,
        // CMS & SaaS extras
        'landing_sections' => \App\Models\LandingSection::class,
        'demo_requests' => \App\Models\DemoRequest::class,
        'tenant_company_info' => \App\Models\TenantCompanyInfo::class,
        'smtp_settings' => \App\Models\SmtpSetting::class,
        // Core connections (fiber)
        'core_connections' => \App\Models\CoreConnection::class,
        // Super Admin
        'super_admins' => \App\Models\SuperAdmin::class,
        'super_admin_sessions' => \App\Models\SuperAdminSession::class,
    ];

    public static function supportedRouteTables(): array
    {
        static $tables = null;

        if ($tables !== null) {
            return $tables;
        }

        $routeTables = [];

        foreach (array_keys((new static())->tableModelMap) as $table) {
            $routeTables[$table] = true;
            $routeTables[str_replace('_', '-', $table)] = true;
        }

        $tables = array_keys($routeTables);

        usort($tables, fn (string $a, string $b) => strlen($b) <=> strlen($a));

        return $tables;
    }

    public static function routeTablePattern(): string
    {
        static $pattern = null;

        if ($pattern !== null) {
            return $pattern;
        }

        $pattern = implode('|', array_map(
            fn (string $table) => preg_quote($table, '/'),
            static::supportedRouteTables()
        ));

        return $pattern;
    }

    protected function getModel(string $table)
    {
        $normalizedTable = str_replace('-', '_', $table);
        $modelClass = $this->tableModelMap[$normalizedTable] ?? $this->tableModelMap[$table] ?? null;
        if (!$modelClass) {
            abort(404, "Table '{$table}' not found");
        }
        return new $modelClass;
    }

    protected function tableHasColumn($model, string $column): bool
    {
        static $cache = [];
        $tableName = $model->getTable();
        if (!isset($cache[$tableName])) {
            $cache[$tableName] = Schema::getColumnListing($tableName);
        }
        return in_array($column, $cache[$tableName]);
    }

    protected function getDefaultSortColumn($model): string
    {
        if ($this->tableHasColumn($model, 'created_at')) return 'created_at';
        if ($this->tableHasColumn($model, 'name')) return 'name';
        if ($this->tableHasColumn($model, 'id')) return 'id';
        return $model->getKeyName();
    }

    /**
     * Parse Supabase-style select string with relation syntax.
     * Example: "*, packages(name, speed), mikrotik_routers(name)"
     * Returns: ['columns' => ['*'], 'relations' => ['packages' => ['name','speed'], ...]]
     */
    protected function parseSelectWithRelations(string $selectStr, $model): array
    {
        $columns = [];
        $relations = [];

        // Remove '+' symbols (Supabase-style relation hints)
        $selectStr = str_replace('+', '', $selectStr);

        // Match relation patterns: relation_name(col1, col2)
        $remaining = preg_replace_callback(
            '/([a-z_]+)\(([^)]+)\)/',
            function ($matches) use ($model, &$relations) {
                $relationName = trim($matches[1]);
                $relCols = array_map('trim', explode(',', $matches[2]));

                // Check if this is a valid Eloquent relationship
                if (method_exists($model, $relationName)) {
                    $relations[$relationName] = $relCols;
                }
                return ''; // Remove from string
            },
            $selectStr
        );

        // Parse remaining columns
        if ($remaining) {
            $parts = array_map('trim', explode(',', $remaining));
            foreach ($parts as $col) {
                if ($col === '' || $col === ',') continue;
                if ($col === '*' || $this->tableHasColumn($model, $col)) {
                    $columns[] = $col;
                }
            }
        }

        if (empty($columns)) {
            $columns = ['*'];
        }

        return ['columns' => $columns, 'relations' => $relations];
    }

    public function index(Request $request, string $table)
    {
        try {
            $model = $this->getModel($table);
            $query = $model->newQuery();

            $excluded = ['page', 'per_page', 'order', 'order_by', 'select', 'search', 'limit', 'with', 'paginate', 'sort_by', 'sort_dir', '_or'];

            // Column filtering
            foreach ($request->except($excluded) as $key => $value) {
                if (str_contains($key, '__')) {
                    [$col, $op] = explode('__', $key, 2);
                    if (!in_array($col, $model->getFillable())) continue;
                    switch ($op) {
                        case 'gte': $query->where($col, '>=', $value); break;
                        case 'lte': $query->where($col, '<=', $value); break;
                        case 'gt': $query->where($col, '>', $value); break;
                        case 'lt': $query->where($col, '<', $value); break;
                        case 'neq': $query->where($col, '!=', $value); break;
                        case 'like': $query->where($col, 'like', $value); break;
                        case 'ilike': $query->where($col, 'like', $value); break;
                        case 'in':
                            $vals = is_array($value) ? $value : explode(',', $value);
                            $query->whereIn($col, $vals);
                            break;
                    }
                    continue;
                }

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

            // OR filters
            if ($request->has('_or')) {
                $orString = $request->get('_or');
                $query->where(function ($q) use ($orString, $model) {
                    $parts = preg_split('/,(?=[a-z_]+\.)/', $orString);
                    foreach ($parts as $part) {
                        if (preg_match('/^([a-z_]+)\.(eq|neq|like|ilike|gte|lte|gt|lt)\.(.+)$/', $part, $m)) {
                            $col = $m[1]; $op = $m[2]; $val = $m[3];
                            if (!in_array($col, $model->getFillable())) continue;
                            switch ($op) {
                                case 'eq': $q->orWhere($col, $val); break;
                                case 'neq': $q->orWhere($col, '!=', $val); break;
                                case 'like': $q->orWhere($col, 'like', $val); break;
                                case 'ilike': $q->orWhere($col, 'like', $val); break;
                                case 'gte': $q->orWhere($col, '>=', $val); break;
                                case 'lte': $q->orWhere($col, '<=', $val); break;
                                case 'gt': $q->orWhere($col, '>', $val); break;
                                case 'lt': $q->orWhere($col, '<', $val); break;
                            }
                        }
                    }
                });
            }

            // Ordering
            $defaultSort = $this->getDefaultSortColumn($model);
            $sortBy = $request->get('sort_by', $request->get('order_by', $defaultSort));
            $sortDir = $request->get('sort_dir', $request->get('order', 'desc'));

            $sortColumns = array_map('trim', explode(',', $sortBy));
            foreach ($sortColumns as $sortCol) {
                $sortCol = ltrim($sortCol, '+');
                if ($this->tableHasColumn($model, $sortCol)) {
                    $query->orderBy($sortCol, $sortDir);
                }
            }

            // Select with relation parsing (Supabase-compatible)
            $eagerRelations = [];
            if ($request->has('select')) {
                $selectStr = $request->get('select');
                $parsed = $this->parseSelectWithRelations($selectStr, $model);

                if (!empty($parsed['columns']) && $parsed['columns'] !== ['*']) {
                    // Always include primary key for relations to work
                    if (!in_array('*', $parsed['columns']) && !in_array('id', $parsed['columns'])) {
                        array_unshift($parsed['columns'], 'id');
                    }
                    // Include foreign keys for relations
                    $fkMap = [
                        'packages' => 'package_id',
                        'mikrotik_routers' => 'router_id',
                        'router' => 'router_id',
                        'package' => 'package_id',
                        'designation' => 'designation_id',
                        'employee' => 'employee_id',
                        'customer' => 'customer_id',
                        'supplier' => 'supplier_id',
                        'vendor' => 'vendor_id',
                        'olt' => 'olt_id',
                        'sale' => 'sale_id',
                        'purchase' => 'purchase_id',
                        'parent' => 'parent_id',
                        'reseller' => 'reseller_id',
                        'product' => 'product_id',
                        'category' => 'category_id',
                        'tenant' => 'tenant_id',
                        'oldReseller' => 'old_reseller_id',
                        'newReseller' => 'new_reseller_id',
                        'zone' => 'zone_id',
                    ];
                    foreach ($parsed['relations'] as $relName => $relCols) {
                        $fkCol = $fkMap[$relName] ?? "{$relName}_id";
                        if ($this->tableHasColumn($model, $fkCol) && !in_array('*', $parsed['columns'])) {
                            $parsed['columns'][] = $fkCol;
                        }
                    }
                    $query->select(array_unique($parsed['columns']));
                }

                // Build eager load constraints for relations
                foreach ($parsed['relations'] as $relName => $relCols) {
                    if (in_array('*', $relCols)) {
                        $eagerRelations[] = $relName;
                    } else {
                        // Select specific columns from relation (always include id + FK)
                        $eagerRelations[$relName] = function ($q) use ($relCols) {
                            $relCols[] = 'id';
                            $q->select(array_unique($relCols));
                        };
                    }
                }
            }

            // Explicit eager loading via ?with= parameter
            if ($request->has('with')) {
                $relations = explode(',', $request->get('with'));
                foreach ($relations as $rel) {
                    $rel = trim($rel);
                    if ($rel && method_exists($model, $rel) && !isset($eagerRelations[$rel]) && !in_array($rel, $eagerRelations)) {
                        $eagerRelations[] = $rel;
                    }
                }
            }

            if (!empty($eagerRelations)) {
                $query->with($eagerRelations);
            }

            // Search
            if ($request->has('search') && method_exists($model, 'getFillable')) {
                $search = $request->get('search');
                $searchable = array_intersect($model->getFillable(), [
                    'name', 'phone', 'email', 'customer_id', 'area', 'subject',
                    'ticket_id', 'employee_id', 'full_name', 'username', 'mobile',
                    'transaction_id', 'sender_phone', 'description', 'reference',
                    'setting_key', 'module', 'action', 'site_name',
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

            if ($request->get('paginate') === 'false' || $request->get('paginate') === '0') {
                return response()->json($query->get());
            }

            $perPage = $request->get('per_page', 50);
            return response()->json($query->paginate($perPage));

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("GenericCrud index error [{$table}]: " . $e->getMessage());
            return response()->json([
                'data' => [],
                'message' => 'Error loading data',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal error',
            ], 200);
        }
    }

    public function show(Request $request, string $table, string $id)
    {
        try {
            $model = $this->getModel($table);
            $query = $model->newQuery();

            if ($request->has('with')) {
                $relations = explode(',', $request->get('with'));
                $validRelations = [];
                foreach ($relations as $rel) {
                    $rel = trim($rel);
                    if ($rel && method_exists($model, $rel)) {
                        $validRelations[] = $rel;
                    }
                }
                if (!empty($validRelations)) {
                    $query->with($validRelations);
                }
            }

            $record = $query->findOrFail($id);
            return response()->json($record);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Record not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error', 'error' => config('app.debug') ? $e->getMessage() : 'Internal error'], 500);
        }
    }

    protected array $singletonTables = ['sms_settings', 'general_settings', 'smtp_settings'];

    protected function destroyAccount(string $id)
    {
        $account = Account::findOrFail($id);

        if ($account->is_system) {
            return response()->json(['message' => 'Cannot delete system account'], 422);
        }

        if ($account->children()->exists()) {
            return response()->json(['message' => 'Cannot delete account with child accounts'], 422);
        }

        $usageChecks = [
            'transactions' => Transaction::where('account_id', $id)->exists(),
            'expenses' => Expense::where('account_id', $id)->exists(),
            'payment gateways' => PaymentGateway::where('receiving_account_id', $id)->exists(),
        ];

        foreach ($usageChecks as $label => $inUse) {
            if ($inUse) {
                return response()->json([
                    'message' => "Cannot delete account because it is used in {$label}",
                ], 422);
            }
        }

        $account->delete();

        return response()->json(['success' => true]);
    }

    public function store(Request $request, string $table)
    {
        try {
            $model = $this->getModel($table);
            $normalizedTable = str_replace('-', '_', $table);
            $fillable = $model->getFillable();

            // ── Batch insert: request body is a JSON array ──
            $content = $request->getContent();
            $decoded = json_decode($content, true);
            if (is_array($decoded) && isset($decoded[0]) && is_array($decoded[0])) {
                $created = [];
                foreach (array_chunk($decoded, 50) as $chunk) {
                    $rows = array_map(fn($row) => array_intersect_key($row, array_flip($fillable)), $chunk);
                    foreach ($rows as $row) {
                        $created[] = $model->newInstance()->create($row);
                    }
                }
                return response()->json($created, 201);
            }

            // ── Single record flow ──
            $input = $request->only($fillable);

            // Singleton upsert
            if (in_array($normalizedTable, $this->singletonTables)) {
                $existing = $model->first();
                if ($existing) {
                    $existing->update(array_intersect_key($request->except(['id', '_upsert']), array_flip($fillable)));
                    return response()->json($existing->fresh());
                }
            }

            // Generic upsert by id
            if ($request->has('_upsert') && $request->has('id')) {
                $existing = $model->find($request->id);
                if ($existing) {
                    $existing->update(array_intersect_key($request->except(['_upsert']), array_flip($fillable)));
                    return response()->json($existing->fresh());
                }
            }

            // Key-based upsert for system_settings (setting_key is unique per tenant)
            if ($request->has('_upsert') && $normalizedTable === 'system_settings' && $request->has('setting_key')) {
                $existing = $model->where('setting_key', $request->setting_key)->first();
                if ($existing) {
                    $existing->update(array_intersect_key($request->except(['_upsert', 'id']), array_flip($fillable)));
                    return response()->json($existing->fresh());
                }
            }

            $record = $model->create($input);
            return response()->json($record, 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("GenericCrud store error [{$table}]: " . $e->getMessage());
            return response()->json(['message' => 'Error creating record', 'error' => config('app.debug') ? $e->getMessage() : 'Internal error'], 500);
        }
    }

    public function update(Request $request, string $table, string $id)
    {
        try {
            $model = $this->getModel($table);
            $record = $model->findOrFail($id);
            $fillable = $model->getFillable();
            $record->update(array_intersect_key($request->all(), array_flip($fillable)));
            return response()->json($record->fresh());
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error updating record', 'error' => config('app.debug') ? $e->getMessage() : 'Internal error'], 500);
        }
    }

    public function destroy(Request $request, string $table, string $id = null)
    {
        try {
            $normalizedTable = str_replace('-', '_', $table);

            // ── Bulk delete (no id, filters via query params) ──
            if (!$id) {
                $model = $this->getModel($table);
                $query = $model->newQuery();
                $fillable = $model->getFillable();

                foreach ($request->except(['paginate', 'per_page', 'page']) as $key => $value) {
                    if (str_contains($key, '__')) {
                        [$col, $op] = explode('__', $key, 2);
                        if (!in_array($col, $fillable) && $col !== 'id') continue;
                        switch ($op) {
                            case 'neq': $query->where($col, '!=', $value); break;
                            case 'in': $query->whereIn($col, is_array($value) ? $value : explode(',', $value)); break;
                            default: $query->where($col, $value); break;
                        }
                    } elseif (in_array($key, $fillable) || $key === 'id') {
                        $query->where($key, $value);
                    }
                }

                $deleted = $query->delete();
                return response()->json(['success' => true, 'deleted' => $deleted]);
            }

            // ── Single delete ──
            if ($normalizedTable === 'accounts') {
                return $this->destroyAccount($id);
            }

            $model = $this->getModel($table);
            $record = $model->findOrFail($id);
            $record->delete();
            return response()->json(['success' => true]);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Record not found'], 404);
        } catch (QueryException $e) {
            Log::error("GenericCrud destroy query error [{$table}:{$id}]: " . $e->getMessage());
            return response()->json([
                'message' => 'Cannot delete record because it is referenced by other data',
                'error' => config('app.debug') ? $e->getMessage() : 'Constraint violation',
            ], 422);
        } catch (\Exception $e) {
            Log::error("GenericCrud destroy error [{$table}:{$id}]: " . $e->getMessage());
            return response()->json(['message' => 'Error deleting record', 'error' => config('app.debug') ? $e->getMessage() : 'Internal error'], 500);
        }
    }
}

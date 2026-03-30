<?php
/**
 * Smart ISP — Complete Schema (No Foreign Keys)
 * All relations are enforced at code/application level.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ══════════════════════════════════════════════════════
        // ═══ AUTH & RBAC ═════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name')->default('Admin');
            $table->string('email')->nullable();
            $table->string('username')->nullable()->unique();
            $table->string('mobile')->nullable();
            $table->text('address')->nullable();
            $table->string('avatar_url')->nullable();
            $table->string('password_hash')->nullable();
            $table->string('staff_id')->nullable();
            $table->string('status')->default('active');
            $table->string('language')->default('en');
            $table->timestamps();
        });

        Schema::create('custom_roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->string('db_role')->default('staff');
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->string('role')->default('staff');
            $table->uuid('custom_role_id')->nullable()->index();
            $table->unique(['user_id', 'role']);
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('module');
            $table->string('action');
            $table->string('description')->nullable();
            $table->unique(['module', 'action']);
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('role_id')->index();
            $table->uuid('permission_id')->index();
            $table->unique(['role_id', 'permission_id']);
        });

        Schema::create('admin_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('admin_id')->index();
            $table->string('session_token')->unique();
            $table->string('ip_address')->default('');
            $table->string('browser')->default('');
            $table->string('device_name')->default('');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('admin_login_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('admin_id')->index();
            $table->string('action');
            $table->string('ip_address')->nullable();
            $table->string('browser')->nullable();
            $table->string('device_name')->nullable();
            $table->uuid('session_id')->nullable()->index();
            $table->timestamp('created_at')->useCurrent();
        });

        // ══════════════════════════════════════════════════════
        // ═══ ISP CORE ════════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('mikrotik_routers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('ip_address');
            $table->string('username')->default('admin');
            $table->string('password');
            $table->integer('api_port')->default(8728);
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('packages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('speed');
            $table->decimal('monthly_price', 10, 2)->default(0);
            $table->integer('download_speed')->default(0);
            $table->integer('upload_speed')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('mikrotik_profile_name')->nullable();
            $table->string('bandwidth_profile')->nullable();
            $table->string('burst_limit')->nullable();
            $table->uuid('router_id')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('customer_id')->unique();
            $table->string('name');
            $table->string('phone');
            $table->string('alt_phone')->nullable();
            $table->string('email')->nullable();
            $table->string('father_name')->nullable();
            $table->string('mother_name')->nullable();
            $table->string('occupation')->nullable();
            $table->string('nid')->nullable();
            $table->string('area');
            $table->string('road')->nullable();
            $table->string('house')->nullable();
            $table->string('city')->nullable();
            $table->string('village')->nullable();
            $table->string('post_office')->nullable();
            $table->string('district')->nullable();
            $table->string('division')->nullable();
            $table->string('upazila')->nullable();
            $table->text('permanent_address')->nullable();
            $table->string('perm_division')->nullable();
            $table->string('perm_district')->nullable();
            $table->string('perm_upazila')->nullable();
            $table->string('perm_village')->nullable();
            $table->string('perm_road')->nullable();
            $table->string('perm_house')->nullable();
            $table->string('perm_post_office')->nullable();
            $table->string('pop_location')->nullable();
            $table->string('box_name')->nullable();
            $table->uuid('package_id')->nullable()->index();
            $table->decimal('monthly_bill', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->nullable();
            $table->decimal('connectivity_fee', 10, 2)->nullable();
            $table->integer('due_date_day')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('gateway')->nullable();
            $table->string('subnet')->nullable();
            $table->string('pppoe_username')->nullable()->unique();
            $table->string('pppoe_password')->nullable();
            $table->string('pppoe_password_hash')->nullable();
            $table->string('onu_mac')->nullable();
            $table->string('router_mac')->nullable();
            $table->string('cable_length')->nullable();
            $table->uuid('router_id')->nullable()->index();
            $table->date('installation_date')->nullable();
            $table->string('installed_by')->nullable();
            $table->string('status')->default('active');
            $table->string('connection_status')->default('active');
            $table->string('mikrotik_sync_status')->default('pending');
            $table->string('username')->nullable();
            $table->string('photo_url')->nullable();
            $table->timestamps();
        });

        Schema::create('bills', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->index();
            $table->string('month');
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('status')->default('unpaid');
            $table->date('due_date')->nullable();
            $table->date('paid_date')->nullable();
            $table->string('payment_link_token')->nullable();
            $table->timestamps();
            $table->unique(['customer_id', 'month']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->index();
            $table->uuid('bill_id')->nullable()->index();
            $table->decimal('amount', 10, 2);
            $table->string('payment_method')->default('cash');
            $table->string('status')->default('completed');
            $table->string('transaction_id')->nullable();
            $table->string('bkash_payment_id')->nullable();
            $table->string('bkash_trx_id')->nullable();
            $table->string('month')->nullable();
            $table->timestamp('paid_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('customer_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->index();
            $table->date('date')->useCurrent();
            $table->string('type')->default('bill');
            $table->string('description');
            $table->decimal('debit', 10, 2)->default(0);
            $table->decimal('credit', 10, 2)->default(0);
            $table->decimal('balance', 10, 2)->default(0);
            $table->string('reference')->nullable();
            $table->timestamps();
        });

        Schema::create('customer_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->index();
            $table->string('session_token')->unique();
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        Schema::create('merchant_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('transaction_id')->unique();
            $table->string('sender_phone');
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('reference')->nullable();
            $table->date('payment_date')->useCurrent();
            $table->string('status')->default('unmatched');
            $table->uuid('matched_customer_id')->nullable()->index();
            $table->uuid('matched_bill_id')->nullable()->index();
            $table->text('notes')->nullable();
            $table->text('sms_text')->nullable();
            $table->timestamps();
        });

        // ══════════════════════════════════════════════════════
        // ═══ SUPPORT ═════════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ticket_id')->unique();
            $table->uuid('customer_id')->index();
            $table->string('subject');
            $table->string('category')->default('general');
            $table->string('priority')->default('medium');
            $table->string('status')->default('open');
            $table->string('assigned_to')->nullable();
            $table->timestamps();
        });

        Schema::create('ticket_replies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('ticket_id')->index();
            $table->text('message');
            $table->string('sender_type')->default('admin');
            $table->string('sender_name');
            $table->timestamp('created_at')->useCurrent();
        });

        // ══════════════════════════════════════════════════════
        // ═══ SMS & NOTIFICATIONS ═════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('sms_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('api_token')->nullable();
            $table->string('sender_id')->nullable();
            $table->boolean('sms_on_bill_generate')->default(false);
            $table->boolean('sms_on_payment')->default(false);
            $table->boolean('sms_on_registration')->default(false);
            $table->boolean('sms_on_suspension')->default(false);
            $table->boolean('sms_on_new_customer_bill')->default(true);
            $table->boolean('sms_on_reminder')->default(false);
            $table->boolean('whatsapp_enabled')->default(false);
            $table->string('whatsapp_token')->nullable();
            $table->string('whatsapp_phone_id')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->text('message');
            $table->timestamps();
        });

        Schema::create('sms_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone');
            $table->text('message');
            $table->string('sms_type');
            $table->string('status')->default('pending');
            $table->text('response')->nullable();
            $table->uuid('customer_id')->nullable()->index();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('reminder_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone');
            $table->text('message');
            $table->string('channel')->default('sms');
            $table->string('status')->default('sent');
            $table->uuid('customer_id')->nullable()->index();
            $table->uuid('bill_id')->nullable()->index();
            $table->timestamp('created_at')->useCurrent();
        });

        // ══════════════════════════════════════════════════════
        // ═══ SETTINGS & LOGS ═════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('general_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('site_name')->default('Smart ISP');
            $table->string('logo_url')->nullable();
            $table->string('login_logo_url')->nullable();
            $table->string('favicon_url')->nullable();
            $table->string('primary_color')->nullable();
            $table->string('email')->nullable();
            $table->string('mobile')->nullable();
            $table->text('address')->nullable();
            $table->string('support_email')->nullable();
            $table->string('support_phone')->nullable();
            $table->timestamps();
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('setting_key')->unique();
            $table->text('setting_value')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_gateways', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('gateway_name')->default('bkash');
            $table->string('environment')->default('sandbox');
            $table->string('status')->default('inactive');
            $table->string('app_key')->nullable();
            $table->string('app_secret')->nullable();
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->string('merchant_number')->nullable();
            $table->string('base_url')->nullable();
            $table->uuid('receiving_account_id')->nullable()->index();
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('admin_id')->index();
            $table->string('admin_name')->default('System');
            $table->string('table_name');
            $table->string('record_id');
            $table->string('action');
            $table->json('old_data')->nullable();
            $table->json('new_data')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('backup_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('file_name');
            $table->bigInteger('file_size')->default(0);
            $table->string('backup_type')->default('manual');
            $table->string('status')->default('completed');
            $table->string('created_by');
            $table->text('error_message')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // ══════════════════════════════════════════════════════
        // ═══ NETWORK (OLT/ONU/Zones) ════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('zones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('area_name');
            $table->text('address')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('olts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('ip_address');
            $table->string('brand')->nullable();
            $table->string('location')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('onus', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('serial_number');
            $table->string('mac_address')->nullable();
            $table->uuid('olt_id')->nullable()->index();
            $table->string('olt_port')->nullable();
            $table->uuid('customer_id')->nullable()->index();
            $table->string('status')->default('active');
            $table->string('signal_strength')->nullable();
            $table->timestamps();
        });

        // ══════════════════════════════════════════════════════
        // ═══ ACCOUNTING ══════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('type');          // asset, liability, income, expense, equity
            $table->string('code')->nullable()->unique();
            $table->uuid('parent_id')->nullable()->index();
            $table->integer('level')->default(0);
            $table->decimal('balance', 14, 2)->default(0);
            $table->text('description')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type')->default('journal');     // income, expense, transfer, journal
            $table->string('category')->nullable();         // payment, purchase, sale, salary, journal, etc.
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('debit', 12, 2)->default(0);
            $table->decimal('credit', 12, 2)->default(0);
            $table->date('date')->nullable();
            $table->text('description')->nullable();
            $table->string('reference')->nullable();        // Generic reference string (payment ID, trx ID, etc.)
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->uuid('account_id')->nullable()->index();
            $table->uuid('customer_id')->nullable()->index();
            $table->uuid('vendor_id')->nullable()->index();
            $table->uuid('created_by')->nullable()->index();
            $table->string('journal_ref')->nullable()->index();
            $table->timestamps();
            $table->index('type');
            $table->index('date');
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('sku')->nullable()->unique();
            $table->string('category')->nullable()->index();
            $table->text('description')->nullable();
            $table->decimal('buy_price', 12, 2)->default(0);
            $table->decimal('sell_price', 12, 2)->default(0);
            $table->integer('stock')->default(0);
            $table->string('unit')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('vendors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('phone')->nullable()->index();
            $table->string('email')->nullable();
            $table->string('company')->nullable();
            $table->text('address')->nullable();
            $table->decimal('total_due', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('purchase_no')->unique();
            $table->uuid('supplier_id')->index();
            $table->date('date');
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('purchase_id')->index();
            $table->uuid('product_id')->nullable()->index();
            $table->string('description')->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('sale_no')->unique();
            $table->uuid('customer_id')->nullable()->index();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->date('sale_date');
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('payment_method')->nullable();
            $table->string('status')->default('completed');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id')->index();
            $table->uuid('product_id')->nullable()->index();
            $table->string('description')->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('category')->default('other');
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('date');
            $table->text('description')->nullable();
            $table->string('payment_method')->default('cash');
            $table->uuid('account_id')->nullable()->index();
            $table->string('reference')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('daily_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date')->unique();
            $table->decimal('total_billed', 14, 2)->default(0);
            $table->decimal('total_collection', 14, 2)->default(0);
            $table->decimal('total_expense', 14, 2)->default(0);
            $table->integer('new_customers')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // ══════════════════════════════════════════════════════
        // ═══ SUPPLIER ════════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('suppliers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('company')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->decimal('total_due', 12, 2)->default(0);
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('supplier_id')->index();
            $table->uuid('purchase_id')->nullable()->index();
            $table->decimal('amount', 12, 2);
            $table->date('paid_date');
            $table->string('payment_method')->default('cash');
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('completed');
            $table->timestamps();
        });

        Schema::create('income_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('expense_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('other_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('type')->default('other');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        // ══════════════════════════════════════════════════════
        // ═══ HR & PAYROLL ════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('designations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('employee_id')->unique();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('nid')->nullable();
            $table->uuid('designation_id')->nullable()->index();
            $table->date('joining_date')->nullable();
            $table->decimal('salary', 12, 2)->default(0);
            $table->string('address')->nullable();
            $table->string('photo_url')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('attendance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->date('date');
            $table->string('status')->default('present');
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'date']);
        });

        Schema::create('loans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('monthly_deduction', 12, 2)->default(0);
            $table->date('approved_date')->nullable();
            $table->string('status')->default('active');
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('salary_sheets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->string('month');
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->decimal('house_rent', 12, 2)->default(0);
            $table->decimal('medical', 12, 2)->default(0);
            $table->decimal('conveyance', 12, 2)->default(0);
            $table->decimal('other_allowance', 12, 2)->default(0);
            $table->decimal('bonus', 12, 2)->default(0);
            $table->decimal('deduction', 12, 2)->default(0);
            $table->decimal('loan_deduction', 12, 2)->default(0);
            $table->decimal('pf_deduction', 12, 2)->default(0);
            $table->decimal('savings_deduction', 12, 2)->default(0);
            $table->decimal('net_salary', 12, 2)->default(0);
            $table->string('payment_method')->default('cash');
            $table->string('status')->default('pending');
            $table->date('paid_date')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'month']);
        });

        Schema::create('employee_salary_structure', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->decimal('house_rent', 12, 2)->default(0);
            $table->decimal('medical', 12, 2)->default(0);
            $table->decimal('conveyance', 12, 2)->default(0);
            $table->decimal('other_allowance', 12, 2)->default(0);
            $table->date('effective_from');
            $table->timestamps();
        });

        Schema::create('employee_education', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->string('degree');
            $table->string('institution');
            $table->string('board_university')->nullable();
            $table->string('passing_year')->nullable();
            $table->string('result')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('employee_experience', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->string('company_name');
            $table->string('designation');
            $table->date('from_date')->nullable();
            $table->date('to_date')->nullable();
            $table->text('responsibilities')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('employee_emergency_contacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->string('contact_name');
            $table->string('relation');
            $table->string('phone');
            $table->string('address')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('employee_provident_fund', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->string('type')->default('contribution');
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('employee_share', 12, 2)->default(0);
            $table->decimal('employer_share', 12, 2)->default(0);
            $table->date('date');
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('employee_savings_fund', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id')->index();
            $table->string('type')->default('deposit');
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('date');
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // ══════════════════════════════════════════════════════
        // ═══ GEO ═════════════════════════════════════════════
        // ══════════════════════════════════════════════════════

        Schema::create('geo_divisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('geo_districts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->uuid('division_id')->index();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('geo_upazilas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->uuid('district_id')->index();
            $table->string('status')->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        $tables = [
            'geo_upazilas', 'geo_districts', 'geo_divisions',
            'employee_savings_fund', 'employee_provident_fund',
            'employee_emergency_contacts', 'employee_experience', 'employee_education',
            'employee_salary_structure', 'salary_sheets', 'loans', 'attendance',
            'employees', 'designations',
            'other_heads', 'expense_heads', 'income_heads',
            'supplier_payments', 'suppliers',
            'daily_reports', 'expenses', 'sale_items', 'sales',
            'purchase_items', 'purchases', 'vendors', 'products',
            'transactions', 'accounts',
            'onus', 'olts', 'zones',
            'backup_logs', 'audit_logs', 'payment_gateways',
            'system_settings', 'general_settings',
            'reminder_logs', 'sms_logs', 'sms_templates', 'sms_settings',
            'ticket_replies', 'support_tickets',
            'merchant_payments', 'customer_sessions', 'customer_ledger',
            'payments', 'bills', 'customers', 'packages', 'mikrotik_routers',
            'admin_login_logs', 'admin_sessions',
            'role_permissions', 'permissions', 'user_roles', 'custom_roles', 'users',
        ];

        foreach ($tables as $t) {
            Schema::dropIfExists($t);
        }
    }
};

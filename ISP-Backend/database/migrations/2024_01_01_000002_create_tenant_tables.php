<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('subdomain')->nullable()->unique();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('logo_url')->nullable();
            $table->string('status')->default('active');
            $table->string('plan')->default('basic');
            $table->timestamp('trial_ends_at')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('domains', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('domain')->unique();
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
        });

        Schema::create('tenant_company_info', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('company_name')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('logo_url')->nullable();
            $table->string('footer_text')->nullable();
            $table->string('invoice_prefix')->nullable();
            $table->text('invoice_notes')->nullable();
            $table->string('tax_id')->nullable();
            $table->string('registration_no')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_company_info');
        Schema::dropIfExists('domains');
        Schema::dropIfExists('tenants');
    }
};

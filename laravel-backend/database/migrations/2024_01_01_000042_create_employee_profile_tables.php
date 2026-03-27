<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_salary_structure', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->decimal('house_rent', 12, 2)->default(0);
            $table->decimal('medical', 12, 2)->default(0);
            $table->decimal('conveyance', 12, 2)->default(0);
            $table->decimal('other_allowance', 12, 2)->default(0);
            $table->date('effective_from')->default(now());
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        Schema::create('employee_education', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->string('degree');
            $table->string('institution');
            $table->string('board_university')->nullable();
            $table->string('passing_year')->nullable();
            $table->string('result')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        Schema::create('employee_experience', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->string('company_name');
            $table->string('designation');
            $table->date('from_date')->nullable();
            $table->date('to_date')->nullable();
            $table->text('responsibilities')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        Schema::create('employee_emergency_contacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->string('contact_name');
            $table->string('relation');
            $table->string('phone');
            $table->string('address')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        Schema::create('employee_provident_fund', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->string('type')->default('contribution'); // contribution, withdrawal
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('employee_share', 12, 2)->default(0);
            $table->decimal('employer_share', 12, 2)->default(0);
            $table->date('date')->default(now());
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        Schema::create('employee_savings_fund', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->string('type')->default('deposit'); // deposit, withdrawal
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('date')->default(now());
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        // Add salary structure columns to salary_sheets
        Schema::table('salary_sheets', function (Blueprint $table) {
            $table->decimal('house_rent', 12, 2)->default(0)->after('basic_salary');
            $table->decimal('medical', 12, 2)->default(0)->after('house_rent');
            $table->decimal('conveyance', 12, 2)->default(0)->after('medical');
            $table->decimal('other_allowance', 12, 2)->default(0)->after('conveyance');
            $table->decimal('pf_deduction', 12, 2)->default(0)->after('loan_deduction');
            $table->decimal('savings_deduction', 12, 2)->default(0)->after('pf_deduction');
        });
    }

    public function down(): void
    {
        Schema::table('salary_sheets', function (Blueprint $table) {
            $table->dropColumn(['house_rent', 'medical', 'conveyance', 'other_allowance', 'pf_deduction', 'savings_deduction']);
        });
        Schema::dropIfExists('employee_savings_fund');
        Schema::dropIfExists('employee_provident_fund');
        Schema::dropIfExists('employee_emergency_contacts');
        Schema::dropIfExists('employee_experience');
        Schema::dropIfExists('employee_education');
        Schema::dropIfExists('employee_salary_structure');
    }
};

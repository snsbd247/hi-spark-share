<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sms_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('api_token')->nullable();
            $table->string('sender_id')->nullable();
            $table->boolean('sms_on_bill_generate')->default(false);
            $table->boolean('sms_on_payment')->default(false);
            $table->boolean('sms_on_registration')->default(false);
            $table->boolean('sms_on_suspension')->default(false);
            $table->boolean('sms_on_new_customer_bill')->default(true);
            $table->boolean('whatsapp_enabled')->default(false);
            $table->string('whatsapp_token')->nullable();
            $table->string('whatsapp_phone_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_settings');
    }
};

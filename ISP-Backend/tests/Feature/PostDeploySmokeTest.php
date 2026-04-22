<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Post-deploy integration smoke tests.
 *
 * These do NOT hit external services (GreenWeb, MikroTik, bKash, SMTP).
 * They confirm that the configuration layer for each integration is
 * intact after a deploy / migration. If any of these fail, the deploy
 * has corrupted an integration's config table or model wiring.
 */
class PostDeploySmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_sms_settings_table_is_readable(): void
    {
        $this->assertTrue(Schema::hasTable('sms_settings'));
        $this->assertTrue(Schema::hasColumn('sms_settings', 'api_token'));
        $this->assertTrue(Schema::hasColumn('sms_settings', 'tenant_id'));

        // Read should not throw — even if the table is empty.
        $count = \DB::table('sms_settings')->count();
        $this->assertIsInt($count);
    }

    public function test_smtp_settings_table_is_readable(): void
    {
        if (!Schema::hasTable('smtp_settings')) {
            $this->markTestSkipped('smtp_settings table not present in this build.');
        }
        $this->assertTrue(Schema::hasColumn('smtp_settings', 'tenant_id'));
        $this->assertIsInt(\DB::table('smtp_settings')->count());
    }

    public function test_payment_gateway_table_is_readable(): void
    {
        if (!Schema::hasTable('payment_gateways')) {
            $this->markTestSkipped('payment_gateways table not present in this build.');
        }
        $this->assertTrue(Schema::hasColumn('payment_gateways', 'tenant_id'));
        $this->assertIsInt(\DB::table('payment_gateways')->count());
    }

    public function test_mikrotik_routers_table_is_readable(): void
    {
        if (!Schema::hasTable('mikrotik_routers')) {
            $this->markTestSkipped('mikrotik_routers table not present in this build.');
        }
        $this->assertTrue(Schema::hasColumn('mikrotik_routers', 'tenant_id'));
        $this->assertIsInt(\DB::table('mikrotik_routers')->count());
    }

    public function test_sms_service_resolves_without_throwing(): void
    {
        $svc = app(\App\Services\SmsService::class);
        $this->assertInstanceOf(\App\Services\SmsService::class, $svc);

        // checkBalance should return a structured array even when no token is set.
        $result = $svc->checkBalance();
        $this->assertIsArray($result);
        $this->assertTrue(array_key_exists('error', $result) || array_key_exists('balance', $result));
    }
}

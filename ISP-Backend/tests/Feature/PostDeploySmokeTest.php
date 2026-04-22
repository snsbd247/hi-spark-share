<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Post-deploy integration smoke test.
 *
 * Read-only / non-destructive verification that the four critical
 * integration layers are wired up correctly after a deployment:
 *   - SMS Gateway (GreenWeb global row)
 *   - SMTP / Email Settings
 *   - Payment Gateways (bKash / Nagad / SSLCommerz)
 *   - MikroTik Routers
 *
 * Failures here SHOULD NOT abort the deploy, but they surface
 * regressions in deploy-update.sh output so an operator can act.
 */
class PostDeploySmokeTest extends TestCase
{
    /** @test */
    public function sms_settings_table_exists_and_has_global_row_slot(): void
    {
        $this->assertTrue(Schema::hasTable('sms_settings'), 'sms_settings table missing');

        // Verify schema supports a global row (tenant_id nullable).
        $this->assertTrue(Schema::hasColumn('sms_settings', 'tenant_id'));
        $this->assertTrue(Schema::hasColumn('sms_settings', 'api_token'));
        $this->assertTrue(Schema::hasColumn('sms_settings', 'sender_id'));

        // Global row is OPTIONAL in fresh installs; only verify uniqueness.
        $globalCount = DB::table('sms_settings')->whereNull('tenant_id')->count();
        $this->assertLessThanOrEqual(1, $globalCount, 'More than one global sms_settings row found');
    }

    /** @test */
    public function smtp_settings_layer_is_intact(): void
    {
        $candidates = ['smtp_settings', 'email_settings', 'mail_settings'];
        $found = false;
        foreach ($candidates as $t) {
            if (Schema::hasTable($t)) { $found = true; break; }
        }
        $this->assertTrue($found, 'No SMTP/email settings table found ('.implode(',', $candidates).')');
    }

    /** @test */
    public function payment_gateway_table_is_intact(): void
    {
        $this->assertTrue(
            Schema::hasTable('payment_gateways') || Schema::hasTable('payment_gateway_settings'),
            'payment_gateways/payment_gateway_settings table missing'
        );
    }

    /** @test */
    public function mikrotik_routers_table_is_intact(): void
    {
        $candidates = ['mikrotik_routers', 'mikrotik_servers', 'routers'];
        $found = false;
        foreach ($candidates as $t) {
            if (Schema::hasTable($t)) { $found = true; break; }
        }
        $this->assertTrue($found, 'No MikroTik routers table found ('.implode(',', $candidates).')');
    }
}

<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\SuperAdminController;
use App\Models\SmsSetting;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use ReflectionClass;
use Tests\TestCase;

/**
 * Verifies that deleting a tenant NEVER removes or mutates the
 * global GreenWeb SMS gateway row in `sms_settings` (tenant_id = NULL).
 *
 * This test is the permanent regression guard for v1.17.7+ behavior.
 */
class SmsGatewayPreservationTest extends TestCase
{
    use RefreshDatabase;

    private function makeTenant(string $name = 'Acme ISP'): Tenant
    {
        return Tenant::create([
            'name' => $name,
            'subdomain' => 'acme-' . Str::random(6),
            'email' => 'acme-' . Str::random(4) . '@example.com',
            'status' => 'active',
        ]);
    }

    private function seedGlobalGateway(): SmsSetting
    {
        $row = new SmsSetting();
        $row->forceFill([
            'tenant_id' => null,
            'api_token' => 'GW-LIVE-TOKEN-XYZ',
            'sender_id' => 'SmartISP',
            'admin_cost_rate' => 0.30,
        ])->save();
        return $row->fresh();
    }

    public function test_tenant_delete_preserves_global_greenweb_row(): void
    {
        $tenant = $this->makeTenant();
        $global = $this->seedGlobalGateway();

        // Add a tenant-scoped SMS settings row to ensure cascade does its job
        // for tenant rows but spares the global one.
        $tenantRow = new SmsSetting();
        $tenantRow->forceFill([
            'tenant_id' => $tenant->id,
            'api_token' => 'TENANT-LOCAL-TOKEN',
            'sender_id' => 'TenantX',
        ])->save();

        $controller = app(SuperAdminController::class);
        $request = \Illuminate\Http\Request::create('/super-admin/tenants/' . $tenant->id, 'DELETE');

        $response = $controller->deleteTenant($request, $tenant->id);
        $this->assertSame(200, $response->getStatusCode());

        // Global row must still exist, untouched.
        $stillThere = SmsSetting::withoutGlobalScopes()->whereNull('tenant_id')->where('id', $global->id)->first();
        $this->assertNotNull($stillThere, 'Global GreenWeb row was removed during tenant delete!');
        $this->assertSame('GW-LIVE-TOKEN-XYZ', $stillThere->api_token);
        $this->assertSame('SmartISP', $stillThere->sender_id);
        $this->assertNull($stillThere->tenant_id);

        // Tenant-scoped SMS row must be gone.
        $this->assertNull(
            SmsSetting::withoutGlobalScopes()->where('id', $tenantRow->id)->first(),
            'Tenant-scoped sms_settings row should have been deleted.'
        );

        // Tenant gone too.
        $this->assertNull(Tenant::find($tenant->id));
    }

    public function test_tenant_delete_auto_promotes_legacy_row_when_no_global_present(): void
    {
        $tenant = $this->makeTenant('Legacy Bound');

        // No global row — only a legacy tenant-bound row that holds the real token.
        $legacy = new SmsSetting();
        $legacy->forceFill([
            'tenant_id' => $tenant->id,
            'api_token' => 'LEGACY-TOKEN-ABC',
            'sender_id' => 'LegacySID',
        ])->save();

        $controller = app(SuperAdminController::class);
        $request = \Illuminate\Http\Request::create('/super-admin/tenants/' . $tenant->id, 'DELETE');
        $controller->deleteTenant($request, $tenant->id);

        // The token must survive — promoted to global (tenant_id = NULL).
        $promoted = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->where('api_token', 'LEGACY-TOKEN-ABC')
            ->first();

        $this->assertNotNull($promoted, 'Legacy tenant-bound gateway should auto-promote to global before tenant delete.');
        $this->assertNull($promoted->tenant_id);
    }
}

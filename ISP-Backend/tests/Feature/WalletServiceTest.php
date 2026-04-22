<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\CustomerWallet;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function ensureCoa(): void
    {
        Account::firstOrCreate(['code' => '1001'], ['name' => 'Cash', 'type' => 'asset', 'level' => 1, 'is_system' => true]);
        Account::firstOrCreate(['code' => '2050'], ['name' => 'Customer Wallet Liability', 'type' => 'liability', 'level' => 1, 'is_system' => true]);
        Account::firstOrCreate(['code' => '4001'], ['name' => 'Subscription Income', 'type' => 'income', 'level' => 1]);
    }

    public function test_credit_increases_balance_and_posts_double_entry(): void
    {
        $this->ensureCoa();
        $customer = Customer::factory()->create();
        $service = app(WalletService::class);

        $service->credit($customer->id, 1000, ['description' => 'Top-up test']);
        $this->assertEquals(1000.0, $service->getBalance($customer->id));

        $cash = Account::where('code', '1001')->first();
        $liab = Account::where('code', '2050')->first();
        $this->assertEquals(1000.0, (float) $cash->fresh()->balance);
        $this->assertEquals(1000.0, (float) $liab->fresh()->balance);
    }

    public function test_debit_blocks_overdraft(): void
    {
        $this->ensureCoa();
        $customer = Customer::factory()->create();
        $service = app(WalletService::class);
        $service->credit($customer->id, 100);

        $this->expectException(\RuntimeException::class);
        $service->debit($customer->id, 200);
    }

    public function test_auto_pay_invoice_when_sufficient(): void
    {
        $this->ensureCoa();
        $customer = Customer::factory()->create();
        $bill = Bill::factory()->create(['customer_id' => $customer->id, 'amount' => 500, 'paid_amount' => 0, 'status' => 'unpaid']);

        $service = app(WalletService::class);
        $service->credit($customer->id, 1000);
        $result = $service->autoPayInvoice($bill->id);

        $this->assertTrue($result['paid']);
        $this->assertEquals('paid', $bill->fresh()->status);
        $this->assertEquals(500.0, $service->getBalance($customer->id));
    }

    public function test_auto_pay_invoice_skips_when_insufficient(): void
    {
        $this->ensureCoa();
        $customer = Customer::factory()->create();
        $bill = Bill::factory()->create(['customer_id' => $customer->id, 'amount' => 500, 'paid_amount' => 0, 'status' => 'unpaid']);

        $service = app(WalletService::class);
        $service->credit($customer->id, 100);
        $result = $service->autoPayInvoice($bill->id);

        $this->assertFalse($result['paid']);
        $this->assertEquals('insufficient_balance', $result['reason']);
        $this->assertEquals('unpaid', $bill->fresh()->status);
    }
}

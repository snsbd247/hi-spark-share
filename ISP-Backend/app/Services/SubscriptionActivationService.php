<?php

namespace App\Services;

use App\Models\SaasPlan;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SubscriptionActivationService
{
    /**
     * When a subscription invoice is marked as paid,
     * activate the tenant and its subscription automatically.
     */
    public static function activateOnInvoicePaid(string $invoiceId): void
    {
        try {
            DB::beginTransaction();

            $invoice = SubscriptionInvoice::find($invoiceId);
            if (!$invoice || !$invoice->tenant_id || !$invoice->plan_id) {
                DB::rollBack();
                return;
            }

            // 1. Mark invoice as paid if not already
            if ($invoice->status !== 'paid') {
                $invoice->update([
                    'status' => 'paid',
                    'paid_date' => now(),
                    'payment_method' => $invoice->payment_method ?: 'manual',
                ]);
            }

            // 2. Get plan details
            $plan = SaasPlan::find($invoice->plan_id);

            // 3. Calculate new expiry
            $billingCycle = $invoice->billing_cycle ?: 'monthly';
            $startDate = now()->toDateString();
            $endDate = $billingCycle === 'yearly'
                ? now()->addYear()->toDateString()
                : now()->addMonth()->toDateString();

            $amount = $invoice->total_amount
                ?? $invoice->amount
                ?? ($billingCycle === 'yearly' ? $plan?->price_yearly : $plan?->price_monthly)
                ?? 0;

            // 4. Update tenant → active with plan limits
            $tenantUpdate = [
                'plan_expire_date' => $endDate,
                'plan_id' => $invoice->plan_id,
                'status' => 'active',
            ];
            if ($plan) {
                $tenantUpdate['plan'] = $plan->slug;
                $tenantUpdate['max_customers'] = $plan->max_customers;
                $tenantUpdate['max_users'] = $plan->max_users;
            }
            Tenant::where('id', $invoice->tenant_id)->update($tenantUpdate);

            // 5. Expire all current active/pending subscriptions for this tenant
            Subscription::where('tenant_id', $invoice->tenant_id)
                ->whereIn('status', ['active', 'pending'])
                ->update(['status' => 'expired']);

            // 6. Find or create the target subscription and activate it
            $targetSub = null;

            if ($invoice->subscription_id) {
                $targetSub = Subscription::find($invoice->subscription_id);
            }

            if (!$targetSub) {
                $targetSub = Subscription::where('tenant_id', $invoice->tenant_id)
                    ->where('plan_id', $invoice->plan_id)
                    ->whereIn('status', ['expired', 'pending', 'active'])
                    ->orderBy('created_at', 'desc')
                    ->first();
            }

            if ($targetSub) {
                $targetSub->update([
                    'status' => 'active',
                    'plan_id' => $invoice->plan_id,
                    'billing_cycle' => $billingCycle,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'amount' => $amount,
                ]);
            } else {
                Subscription::create([
                    'tenant_id' => $invoice->tenant_id,
                    'plan_id' => $invoice->plan_id,
                    'billing_cycle' => $billingCycle,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'status' => 'active',
                    'amount' => $amount,
                ]);
            }

            DB::commit();
            Log::info("Subscription activated for tenant {$invoice->tenant_id} via invoice {$invoiceId}");
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("SubscriptionActivationService failed: " . $e->getMessage());
            throw $e;
        }
    }
}

<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\PaymentGateway;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BkashService
{
    protected ?PaymentGateway $gateway = null;
    protected ?string $token = null;

    public function __construct(
        protected LedgerService $ledgerService,
        protected SmsService $smsService
    ) {}

    protected function loadGateway(): PaymentGateway
    {
        if (!$this->gateway) {
            $this->gateway = PaymentGateway::where('gateway_name', 'bkash')
                ->whereIn('status', ['active', 'connected'])
                ->firstOrFail();
        }
        return $this->gateway;
    }

    protected function getToken(): string
    {
        if ($this->token) return $this->token;

        $gw = $this->loadGateway();
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'username' => $gw->username,
            'password' => $gw->password,
        ])->post($gw->base_url . '/tokenized/checkout/token/grant', [
            'app_key' => $gw->app_key,
            'app_secret' => $gw->app_secret,
        ]);

        $data = $response->json();
        $this->token = $data['id_token'] ?? '';

        $gw->update(['last_connected_at' => now()]);

        return $this->token;
    }

    public function createPayment(string $billId, string $customerId, ?float $amount = null, string $callbackUrl = ''): array
    {
        try {
            $bill = Bill::findOrFail($billId);
            $payAmount = $amount ?? (float) $bill->amount;

            $gw = $this->loadGateway();
            $token = $this->getToken();
            $invoiceNumber = 'INV-' . time();

            $response = Http::withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $gw->app_key,
                'Content-Type' => 'application/json',
            ])->post($gw->base_url . '/tokenized/checkout/create', [
                'mode' => '0011',
                'payerReference' => $customerId,
                'callbackURL' => $callbackUrl,
                'amount' => number_format($payAmount, 2, '.', ''),
                'currency' => 'BDT',
                'intent' => 'sale',
                'merchantInvoiceNumber' => $invoiceNumber,
            ]);

            $data = $response->json();

            if (!empty($data['bkashURL'])) {
                // Create pending payment record
                Payment::create([
                    'customer_id' => $customerId,
                    'bill_id' => $billId,
                    'amount' => $payAmount,
                    'payment_method' => 'bkash',
                    'status' => 'pending',
                    'bkash_payment_id' => $data['paymentID'] ?? null,
                    'transaction_id' => $invoiceNumber,
                ]);

                return ['success' => true, 'bkashURL' => $data['bkashURL'], 'paymentID' => $data['paymentID'] ?? null];
            }

            return ['success' => false, 'error' => $data['statusMessage'] ?? 'Failed to create payment'];
        } catch (\Exception $e) {
            Log::error('bKash create payment failed: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function executePayment(string $paymentId, string $status): array
    {
        if ($status !== 'success') {
            return ['success' => false, 'error' => "Payment status: {$status}"];
        }

        try {
            $gw = $this->loadGateway();
            $token = $this->getToken();

            $response = Http::withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $gw->app_key,
                'Content-Type' => 'application/json',
            ])->post($gw->base_url . '/tokenized/checkout/execute', [
                'paymentID' => $paymentId,
            ]);

            $data = $response->json();

            if (($data['statusCode'] ?? '') === '0000' && ($data['transactionStatus'] ?? '') === 'Completed') {
                $payment = Payment::where('bkash_payment_id', $paymentId)->first();

                if ($payment) {
                    $payment->update([
                        'status' => 'completed',
                        'bkash_trx_id' => $data['trxID'] ?? null,
                        'transaction_id' => $data['trxID'] ?? $payment->transaction_id,
                        'paid_at' => now(),
                    ]);

                    // Mark bill as paid
                    $billMonth = null;
                    if ($payment->bill_id) {
                        $bill = Bill::find($payment->bill_id);
                        if ($bill) {
                            $bill->update(['status' => 'paid', 'paid_date' => now()]);
                            $billMonth = $bill->month;
                            if ($billMonth) {
                                $payment->update(['month' => $billMonth]);
                            }
                        }
                    }

                    // Customer ledger credit
                    $this->ledgerService->addCredit(
                        $payment->customer_id,
                        (float) $payment->amount,
                        "Payment Received (bKash - TrxID: {$data['trxID']})",
                        "TXN-{$data['trxID']}"
                    );

                    // Post to accounting
                    $customer = Customer::find($payment->customer_id);
                    $customerName = $customer ? $customer->name : 'Unknown';
                    $this->ledgerService->postServiceIncome(
                        (float) $payment->amount,
                        "bKash Payment - {$customerName} (TrxID: {$data['trxID']})",
                        $payment->id
                    );

                    // Check reactivation
                    if ($customer && $customer->connection_status === 'suspended') {
                        $unpaidCount = Bill::where('customer_id', $customer->id)
                            ->where('status', 'unpaid')
                            ->where('due_date', '<', now()->toDateString())
                            ->count();
                        if ($unpaidCount === 0) {
                            $customer->update(['connection_status' => 'pending_reactivation', 'status' => 'active']);
                        }
                    }

                    // Send confirmation SMS
                    if ($customer && $customer->phone) {
                        try {
                            $monthText = $billMonth ? " ({$billMonth})" : '';
                            $msg = "প্রিয় {$customer->name}, আপনার bKash পেমেন্ট ৳{$payment->amount}{$monthText} সফলভাবে গৃহীত হয়েছে। TrxID: {$data['trxID']}। ধন্যবাদ - Smart ISP";
                            $this->smsService->send($customer->phone, $msg, 'receipt', $customer->id);
                        } catch (\Exception $e) {
                            Log::error('bKash payment SMS failed: ' . $e->getMessage());
                        }
                    }
                }

                return ['success' => true, 'trxID' => $data['trxID'] ?? null, 'data' => $data];
            }

            // Payment failed - update status
            Payment::where('bkash_payment_id', $paymentId)->update(['status' => 'failed']);

            return ['success' => false, 'error' => $data['statusMessage'] ?? 'Payment failed'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function refundPayment(string $paymentId, string $trxId, float $amount, ?string $reason = null): array
    {
        try {
            $gw = $this->loadGateway();
            $token = $this->getToken();

            $response = Http::withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $gw->app_key,
                'Content-Type' => 'application/json',
            ])->post($gw->base_url . '/tokenized/checkout/payment/refund', [
                'paymentID' => $paymentId,
                'trxID' => $trxId,
                'amount' => number_format($amount, 2, '.', ''),
                'reason' => $reason ?? 'Customer refund',
                'sku' => 'ISP-REFUND',
            ]);

            $data = $response->json();

            if (($data['transactionStatus'] ?? '') === 'Completed' || ($data['statusCode'] ?? '') === '0000') {
                $payment = Payment::where('bkash_payment_id', $paymentId)->first();

                if ($payment) {
                    $payment->update(['status' => 'refunded']);

                    // Reverse ledger: add debit entry
                    $this->ledgerService->addDebit(
                        $payment->customer_id,
                        $amount,
                        "Payment Refunded (bKash - TrxID: {$trxId})",
                        "REFUND-{$trxId}"
                    );

                    // Reverse accounting entries
                    $this->ledgerService->reverseServiceIncome($amount, $payment->id);

                    // Mark bill as unpaid
                    if ($payment->bill_id) {
                        Bill::where('id', $payment->bill_id)->update([
                            'status' => 'unpaid',
                            'paid_date' => null,
                        ]);
                    }

                    // Send refund SMS
                    $customer = Customer::find($payment->customer_id);
                    if ($customer && $customer->phone) {
                        try {
                            $msg = "Dear {$customer->name}, your bKash payment of ৳{$amount} (TrxID: {$trxId}) has been refunded. Contact support if you have questions. - Smart ISP";
                            $this->smsService->send($customer->phone, $msg, 'refund', $customer->id);
                        } catch (\Exception $e) {
                            Log::error('bKash refund SMS failed: ' . $e->getMessage());
                        }
                    }
                }

                return ['success' => true, 'data' => $data];
            }

            return ['success' => false, 'error' => $data['statusMessage'] ?? 'Refund failed'];
        } catch (\Exception $e) {
            Log::error('bKash refund failed: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function queryTransaction(string $paymentId): array
    {
        try {
            $gw = $this->loadGateway();
            $token = $this->getToken();

            $response = Http::withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $gw->app_key,
                'Content-Type' => 'application/json',
            ])->post($gw->base_url . '/tokenized/checkout/payment/status', [
                'paymentID' => $paymentId,
            ]);

            return ['success' => true, 'data' => $response->json()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function testConnection(): array
    {
        try {
            $gw = $this->loadGateway();
            $this->getToken();
            $gw->update(['status' => 'connected', 'last_connected_at' => now()]);
            return ['success' => true, 'message' => 'Connection successful'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}

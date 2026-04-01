<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Models\Payment;
use App\Models\Bill;
use App\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SslCommerzController extends Controller
{
    use ApiResponse;

    /**
     * Initiate SSLCommerz payment
     */
    public function createPayment(Request $request)
    {
        $request->validate([
            'bill_id' => 'nullable|uuid',
            'customer_id' => 'nullable|uuid',
            'subscription_id' => 'nullable|uuid',
            'amount' => 'required|numeric|min:10',
            'customer_name' => 'required|string|max:255',
            'customer_email' => 'nullable|email',
            'customer_phone' => 'required|string|max:20',
        ]);

        $storeId = config('services.sslcommerz.store_id');
        $storePassword = config('services.sslcommerz.store_password');
        $baseUrl = config('services.sslcommerz.base_url', 'https://sandbox.sslcommerz.com');

        if (!$storeId || !$storePassword) {
            return $this->error('SSLCommerz credentials not configured', 500);
        }

        $tranId = 'TXN-' . Str::upper(Str::random(12));

        $postData = [
            'store_id' => $storeId,
            'store_passwd' => $storePassword,
            'total_amount' => $request->amount,
            'currency' => 'BDT',
            'tran_id' => $tranId,
            'success_url' => url('/api/sslcommerz/success'),
            'fail_url' => url('/api/sslcommerz/fail'),
            'cancel_url' => url('/api/sslcommerz/cancel'),
            'ipn_url' => url('/api/sslcommerz/ipn'),
            'cus_name' => $request->customer_name,
            'cus_email' => $request->customer_email ?? 'customer@example.com',
            'cus_phone' => $request->customer_phone,
            'cus_add1' => 'N/A',
            'cus_city' => 'N/A',
            'cus_country' => 'Bangladesh',
            'shipping_method' => 'NO',
            'product_name' => 'ISP Bill Payment',
            'product_category' => 'Service',
            'product_profile' => 'non-physical-goods',
            'value_a' => $request->bill_id ?? '',
            'value_b' => $request->customer_id ?? '',
            'value_c' => $request->subscription_id ?? '',
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $baseUrl . '/gwprocess/v4/api.php');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$response) {
            return $this->error('Could not connect to SSLCommerz', 502);
        }

        $result = json_decode($response, true);

        if (isset($result['status']) && $result['status'] === 'SUCCESS') {
            return $this->success([
                'gateway_url' => $result['GatewayPageURL'],
                'session_key' => $result['sessionkey'] ?? null,
                'tran_id' => $tranId,
            ], 'Payment session created');
        }

        return $this->error($result['failedreason'] ?? 'Payment initiation failed', 422);
    }

    /**
     * SSLCommerz success callback
     */
    public function success(Request $request)
    {
        $valid = $this->validateTransaction($request);

        if (!$valid) {
            return redirect(config('app.frontend_url', '/') . '/payment/failed?reason=validation_failed');
        }

        $billId = $request->input('value_a');
        $customerId = $request->input('value_b');
        $subscriptionId = $request->input('value_c');
        $tranId = $request->input('tran_id');
        $amount = $request->input('amount');

        // Record payment
        if ($billId) {
            Payment::create([
                'customer_id' => $customerId,
                'bill_id' => $billId,
                'amount' => $amount,
                'payment_method' => 'sslcommerz',
                'status' => 'completed',
                'transaction_id' => $tranId,
                'paid_at' => now(),
            ]);

            Bill::where('id', $billId)->update([
                'status' => 'paid',
                'paid_date' => now()->toDateString(),
            ]);
        }

        // Auto-activate subscription if applicable
        if ($subscriptionId) {
            Subscription::where('id', $subscriptionId)->update([
                'status' => 'active',
                'payment_status' => 'paid',
            ]);
        }

        return redirect(config('app.frontend_url', '/') . '/payment/success?tran_id=' . $tranId);
    }

    /**
     * SSLCommerz fail callback
     */
    public function fail(Request $request)
    {
        return redirect(config('app.frontend_url', '/') . '/payment/failed?reason=payment_failed');
    }

    /**
     * SSLCommerz cancel callback
     */
    public function cancel(Request $request)
    {
        return redirect(config('app.frontend_url', '/') . '/payment/failed?reason=cancelled');
    }

    /**
     * IPN (Instant Payment Notification) handler
     */
    public function ipn(Request $request)
    {
        $valid = $this->validateTransaction($request);

        if (!$valid) {
            return response()->json(['status' => 'INVALID'], 400);
        }

        $billId = $request->input('value_a');
        $customerId = $request->input('value_b');
        $subscriptionId = $request->input('value_c');
        $tranId = $request->input('tran_id');
        $amount = $request->input('amount');
        $status = $request->input('status');

        if ($status === 'VALID' || $status === 'VALIDATED') {
            // Check if payment already processed
            $existing = Payment::where('transaction_id', $tranId)->first();
            if ($existing) {
                return response()->json(['status' => 'ALREADY_PROCESSED']);
            }

            if ($billId) {
                Payment::create([
                    'customer_id' => $customerId,
                    'bill_id' => $billId,
                    'amount' => $amount,
                    'payment_method' => 'sslcommerz',
                    'status' => 'completed',
                    'transaction_id' => $tranId,
                    'paid_at' => now(),
                ]);

                Bill::where('id', $billId)->update([
                    'status' => 'paid',
                    'paid_date' => now()->toDateString(),
                ]);
            }

            if ($subscriptionId) {
                Subscription::where('id', $subscriptionId)->update([
                    'status' => 'active',
                    'payment_status' => 'paid',
                ]);
            }
        }

        return response()->json(['status' => 'OK']);
    }

    /**
     * Validate transaction with SSLCommerz API
     */
    private function validateTransaction(Request $request): bool
    {
        $storeId = config('services.sslcommerz.store_id');
        $storePassword = config('services.sslcommerz.store_password');
        $baseUrl = config('services.sslcommerz.base_url', 'https://sandbox.sslcommerz.com');
        $validationId = $request->input('val_id');

        if (!$validationId || !$storeId || !$storePassword) {
            return false;
        }

        $url = $baseUrl . '/validator/api/validationserverAPI.php?'
            . 'val_id=' . urlencode($validationId)
            . '&store_id=' . urlencode($storeId)
            . '&store_passwd=' . urlencode($storePassword)
            . '&format=json';

        $response = file_get_contents($url);
        if (!$response) return false;

        $result = json_decode($response, true);
        return isset($result['status']) && ($result['status'] === 'VALID' || $result['status'] === 'VALIDATED');
    }

    /**
     * Test SSLCommerz connection
     */
    public function testConnection()
    {
        $storeId = config('services.sslcommerz.store_id');
        $storePassword = config('services.sslcommerz.store_password');

        if (!$storeId || !$storePassword) {
            return $this->error('SSLCommerz credentials not configured', 422);
        }

        return $this->success([
            'store_id' => $storeId,
            'is_sandbox' => str_contains(config('services.sslcommerz.base_url', ''), 'sandbox'),
        ], 'SSLCommerz configured successfully');
    }
}

<?php

return [

    'postmark' => ['token' => env('POSTMARK_TOKEN')],
    'ses' => ['key' => env('AWS_ACCESS_KEY_ID'), 'secret' => env('AWS_SECRET_ACCESS_KEY'), 'region' => env('AWS_DEFAULT_REGION', 'us-east-1')],
    'slack' => ['notifications' => ['bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'), 'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL')]],

    // GreenWeb SMS
    'greenweb' => [
        'token' => env('GREENWEB_SMS_TOKEN'),
    ],

    // bKash Payment
    'bkash' => [
        'app_key' => env('BKASH_APP_KEY'),
        'app_secret' => env('BKASH_APP_SECRET'),
        'username' => env('BKASH_USERNAME'),
        'password' => env('BKASH_PASSWORD'),
        'base_url' => env('BKASH_BASE_URL', 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
    ],

    // Nagad Payment
    'nagad' => [
        'merchant_id' => env('NAGAD_MERCHANT_ID'),
        'merchant_number' => env('NAGAD_MERCHANT_NUMBER'),
        'public_key' => env('NAGAD_PUBLIC_KEY'),
        'private_key' => env('NAGAD_PRIVATE_KEY'),
        'base_url' => env('NAGAD_BASE_URL', 'https://sandbox.mynagad.com:10061/remote-payment-gateway-1.0/api/dfs'),
    ],

    // SSLCommerz Payment
    'sslcommerz' => [
        'store_id' => env('SSLCOMMERZ_STORE_ID'),
        'store_password' => env('SSLCOMMERZ_STORE_PASSWORD'),
        'base_url' => env('SSLCOMMERZ_BASE_URL', 'https://sandbox.sslcommerz.com'),
    ],

];

<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| This is an API-only backend. The web route simply returns
| a JSON health-check response. The React frontend is served
| separately (Vite dev-server or static build).
|
*/

Route::get('/', function () {
    return response()->json([
        'app'     => config('app.name', 'Smart ISP'),
        'status'  => 'running',
        'version' => '1.0.0',
        'time'    => now()->toIso8601String(),
    ]);
});

// Health check endpoint
Route::get('/health', function () {
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Exception $e) {
        $dbStatus = 'disconnected';
    }

    return response()->json([
        'status'   => 'ok',
        'database' => $dbStatus,
        'php'      => PHP_VERSION,
        'laravel'  => app()->version(),
    ]);
});

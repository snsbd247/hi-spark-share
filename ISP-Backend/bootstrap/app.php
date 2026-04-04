<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'admin.auth'        => \App\Http\Middleware\AdminAuth::class,
            'customer.auth'     => \App\Http\Middleware\CustomerAuth::class,
            'reseller.auth'     => \App\Http\Middleware\ResellerAuth::class,
            'check.permission'  => \App\Http\Middleware\CheckPermission::class,
            'tenant.resolve'    => \App\Http\Middleware\ResolveTenant::class,
            'super.admin.auth'  => \App\Http\Middleware\SuperAdminAuth::class,
            'check.subscription'=> \App\Http\Middleware\CheckSubscription::class,
            'check.plan_module' => \App\Http\Middleware\CheckPlanModule::class,
        ]);

        // Apply tenant resolution + Sanctum to all API requests
        $middleware->api(prepend: [
            \App\Http\Middleware\ResolveTenant::class,
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

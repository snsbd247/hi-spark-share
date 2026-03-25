<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Bind services for dependency injection
        $this->app->singleton(\App\Services\BillingService::class, function ($app) {
            return new \App\Services\BillingService($app->make(\App\Services\LedgerService::class));
        });

        $this->app->singleton(\App\Services\LedgerService::class);
        $this->app->singleton(\App\Services\MikrotikService::class);
        $this->app->singleton(\App\Services\SmsService::class);
        $this->app->singleton(\App\Services\EmailService::class);
        $this->app->singleton(\App\Services\BkashService::class);
        $this->app->singleton(\App\Services\NagadService::class);
        $this->app->singleton(\App\Services\WhatsappService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Fix for older MySQL versions
        Schema::defaultStringLength(191);

        // Force HTTPS in production
        if ($this->app->environment('production')) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }
    }
}

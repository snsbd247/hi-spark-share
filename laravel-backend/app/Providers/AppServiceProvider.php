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
        // Core ISP services
        $this->app->singleton(\App\Services\LedgerService::class);
        $this->app->singleton(\App\Services\BillingService::class, function ($app) {
            return new \App\Services\BillingService($app->make(\App\Services\LedgerService::class));
        });
        $this->app->singleton(\App\Services\MikrotikService::class);
        $this->app->singleton(\App\Services\SmsService::class);
        $this->app->singleton(\App\Services\EmailService::class);
        $this->app->singleton(\App\Services\BkashService::class);
        $this->app->singleton(\App\Services\NagadService::class);
        $this->app->singleton(\App\Services\WhatsappService::class);

        // Accounting & Inventory services
        $this->app->singleton(\App\Services\InventoryService::class);
        $this->app->singleton(\App\Services\AccountingService::class);
        $this->app->singleton(\App\Services\PurchaseService::class, function ($app) {
            return new \App\Services\PurchaseService(
                $app->make(\App\Services\InventoryService::class),
                $app->make(\App\Services\AccountingService::class)
            );
        });
        $this->app->singleton(\App\Services\SalesService::class, function ($app) {
            return new \App\Services\SalesService(
                $app->make(\App\Services\InventoryService::class),
                $app->make(\App\Services\AccountingService::class)
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        if ($this->app->environment('production')) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }
    }
}

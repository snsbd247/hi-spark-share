<?php

namespace App\Http\Middleware;

use App\Models\GeneralSetting;
use Closure;
use Illuminate\Http\Request;

class TenantMiddleware
{
    /**
     * Load tenant/ISP branding settings into the request
     * so controllers can access them via $request->get('tenant').
     */
    public function handle(Request $request, Closure $next)
    {
        $settings = GeneralSetting::first();

        if ($settings) {
            $request->merge([
                'tenant' => [
                    'site_name'     => $settings->site_name,
                    'logo_url'      => $settings->logo_url,
                    'primary_color' => $settings->primary_color,
                    'email'         => $settings->email,
                    'mobile'        => $settings->mobile,
                    'address'       => $settings->address,
                ],
            ]);
        }

        return $next($request);
    }
}

<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     * Since this is an API-only backend, we exclude all API routes.
     */
    protected $except = [
        'api/*',
        'bkash/*',
        'nagad/*',
    ];
}

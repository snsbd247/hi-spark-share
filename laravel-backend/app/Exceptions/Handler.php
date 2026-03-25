<?php

namespace App\Exceptions;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed for validation exceptions.
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });

        $this->renderable(function (ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Resource not found',
                'message' => 'The requested resource was not found.',
            ], 404);
        });

        $this->renderable(function (NotFoundHttpException $e) {
            return response()->json([
                'error' => 'Not found',
                'message' => 'The requested endpoint does not exist.',
            ], 404);
        });

        $this->renderable(function (MethodNotAllowedHttpException $e) {
            return response()->json([
                'error' => 'Method not allowed',
                'message' => $e->getMessage(),
            ], 405);
        });

        $this->renderable(function (ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        });

        $this->renderable(function (AuthenticationException $e) {
            return response()->json([
                'error' => 'Unauthenticated',
                'message' => 'You must be logged in to access this resource.',
            ], 401);
        });
    }
}

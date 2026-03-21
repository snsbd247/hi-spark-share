<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SendEmailRequest;
use App\Services\EmailService;

class EmailController extends Controller
{
    public function __construct(protected EmailService $emailService) {}

    public function send(SendEmailRequest $request)
    {

        $result = $this->emailService->send(
            $request->to,
            $request->subject,
            $request->html,
            $request->from_name
        );

        return response()->json($result);
    }
}

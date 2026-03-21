<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\Request;

class EmailController extends Controller
{
    public function __construct(protected EmailService $emailService) {}

    public function send(Request $request)
    {
        $request->validate([
            'to' => 'required|email',
            'subject' => 'required|string',
            'html' => 'required|string',
        ]);

        $result = $this->emailService->send(
            $request->to,
            $request->subject,
            $request->html,
            $request->from_name
        );

        return response()->json($result);
    }
}

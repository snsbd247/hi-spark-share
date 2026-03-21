<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\SupportTicket;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    public function dashboard(Request $request)
    {
        $customer = $request->get('portal_customer');

        $bills = Bill::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->limit(6)
            ->get();

        $payments = Payment::where('customer_id', $customer->id)
            ->orderBy('paid_at', 'desc')
            ->limit(5)
            ->get();

        $unpaidCount = Bill::where('customer_id', $customer->id)
            ->where('status', 'unpaid')
            ->count();

        $totalDue = Bill::where('customer_id', $customer->id)
            ->where('status', 'unpaid')
            ->sum('amount');

        return response()->json([
            'customer' => $customer->only(['id', 'customer_id', 'name', 'phone', 'area', 'status', 'monthly_bill', 'package_id', 'photo_url']),
            'bills' => $bills,
            'recent_payments' => $payments,
            'unpaid_count' => $unpaidCount,
            'total_due' => (float) $totalDue,
        ]);
    }

    public function bills(Request $request)
    {
        $customer = $request->get('portal_customer');
        $bills = Bill::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->paginate(20);
        return response()->json($bills);
    }

    public function payments(Request $request)
    {
        $customer = $request->get('portal_customer');
        $payments = Payment::where('customer_id', $customer->id)
            ->orderBy('paid_at', 'desc')
            ->paginate(20);
        return response()->json($payments);
    }

    public function tickets(Request $request)
    {
        $customer = $request->get('portal_customer');
        $tickets = SupportTicket::where('customer_id', $customer->id)
            ->with('replies')
            ->orderBy('created_at', 'desc')
            ->paginate(20);
        return response()->json($tickets);
    }

    public function createTicket(Request $request)
    {
        $customer = $request->get('portal_customer');
        $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);

        $ticket = SupportTicket::create([
            'customer_id' => $customer->id,
            'ticket_id' => 'TKT-' . strtoupper(substr(md5(uniqid()), 0, 8)),
            'subject' => $request->subject,
            'category' => $request->get('category', 'general'),
            'priority' => $request->get('priority', 'medium'),
        ]);

        // Add initial message as reply
        $ticket->replies()->create([
            'message' => $request->message,
            'sender_type' => 'customer',
            'sender_name' => $customer->name,
        ]);

        return response()->json($ticket->load('replies'), 201);
    }

    public function profile(Request $request)
    {
        $customer = $request->get('portal_customer');
        $customer->load('package');
        return response()->json($customer->only([
            'id', 'customer_id', 'name', 'phone', 'alt_phone', 'email',
            'area', 'road', 'house', 'city', 'status', 'monthly_bill',
            'discount', 'package_id', 'installation_date', 'photo_url', 'package',
        ]));
    }
}

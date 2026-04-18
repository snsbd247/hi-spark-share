<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\CustomerLedger;
use App\Models\Package;
use App\Models\Payment;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    public function dashboard(Request $request)
    {
        $customer = $request->get('portal_customer');
        $customer->load('package');

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

        $totalDue = (float) Bill::where('customer_id', $customer->id)
            ->where('status', 'unpaid')
            ->sum('amount');

        // Last payment info
        $lastPayment = Payment::where('customer_id', $customer->id)
            ->where('status', 'completed')
            ->orderBy('paid_at', 'desc')
            ->first();

        // Ledger balance
        $ledgerBalance = CustomerLedger::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->value('balance') ?? 0;

        // Open tickets count
        $openTickets = SupportTicket::where('customer_id', $customer->id)
            ->whereIn('status', ['open', 'in_progress'])
            ->count();

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'customer_id' => $customer->customer_id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'area' => $customer->area,
                'status' => $customer->status,
                'monthly_bill' => $customer->monthly_bill,
                'package_id' => $customer->package_id,
                'photo_url' => $customer->photo_url,
                'connection_status' => $customer->connection_status,
                'pppoe_username' => $customer->pppoe_username,
                'ip_address' => $customer->ip_address,
                'package' => $customer->package ? [
                    'name' => $customer->package->name,
                    'speed' => $customer->package->speed,
                    'download_speed' => $customer->package->download_speed,
                    'upload_speed' => $customer->package->upload_speed,
                ] : null,
            ],
            'bills' => $bills,
            'recent_payments' => $payments,
            'unpaid_count' => $unpaidCount,
            'total_due' => (float) $totalDue,
            'ledger_balance' => (float) $ledgerBalance,
            'open_tickets' => $openTickets,
            'last_payment' => $lastPayment ? [
                'amount' => (float) $lastPayment->amount,
                'paid_at' => $lastPayment->paid_at,
                'method' => $lastPayment->payment_method,
            ] : null,
        ]);
    }

    public function bills(Request $request)
    {
        $customer = $request->get('portal_customer');
        $bills = Bill::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));
        return response()->json($bills);
    }

    public function payments(Request $request)
    {
        $customer = $request->get('portal_customer');
        $payments = Payment::where('customer_id', $customer->id)
            ->orderBy('paid_at', 'desc')
            ->paginate($request->get('per_page', 20));
        return response()->json($payments);
    }

    public function tickets(Request $request)
    {
        $customer = $request->get('portal_customer');
        $tickets = SupportTicket::where('customer_id', $customer->id)
            ->with('replies')
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));
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

        $ticket->replies()->create([
            'message' => $request->message,
            'sender_type' => 'customer',
            'sender_name' => $customer->name,
        ]);

        return response()->json($ticket->load('replies'), 201);
    }

    public function replyTicket(Request $request, string $id)
    {
        $customer = $request->get('portal_customer');
        $request->validate(['message' => 'required|string']);

        $ticket = SupportTicket::where('customer_id', $customer->id)
            ->findOrFail($id);

        $reply = $ticket->replies()->create([
            'message' => $request->message,
            'sender_type' => 'customer',
            'sender_name' => $customer->name,
        ]);

        // Reopen if closed
        if ($ticket->status === 'closed') {
            $ticket->update(['status' => 'open']);
        }

        return response()->json($reply, 201);
    }

    public function profile(Request $request)
    {
        $customer = $request->get('portal_customer');
        $customer->load('package');
        return response()->json([
            'id' => $customer->id,
            'customer_id' => $customer->customer_id,
            'name' => $customer->name,
            'phone' => $customer->phone,
            'alt_phone' => $customer->alt_phone,
            'email' => $customer->email,
            'father_name' => $customer->father_name,
            'mother_name' => $customer->mother_name,
            'nid' => $customer->nid,
            'area' => $customer->area,
            'division' => $customer->division,
            'district' => $customer->district,
            'upazila' => $customer->upazila,
            'road' => $customer->road,
            'house' => $customer->house,
            'village' => $customer->village,
            'post_office' => $customer->post_office,
            'city' => $customer->city,
            'permanent_address' => $customer->permanent_address,
            'status' => $customer->status,
            'monthly_bill' => $customer->monthly_bill,
            'discount' => $customer->discount,
            'package_id' => $customer->package_id,
            'installation_date' => $customer->installation_date,
            'photo_url' => $customer->photo_url,
            'connection_status' => $customer->connection_status,
            'pppoe_username' => $customer->pppoe_username,
            'ip_address' => $customer->ip_address,
            'onu_mac' => $customer->onu_mac,
            'router_mac' => $customer->router_mac,
            'due_date_day' => $customer->due_date_day,
            'package' => $customer->package,
        ]);
    }

    public function updateProfile(Request $request)
    {
        $customer = $request->get('portal_customer');
        $customer->update($request->only(['alt_phone', 'email', 'photo_url']));
        return response()->json(['success' => true]);
    }

    /**
     * Phase 13 — Customer-facing ONU connection health.
     * Returns ONU live status + 24h signal trend + recent outage events
     * for the authenticated portal customer's own ONU only.
     */
    public function connectionHealth(Request $request)
    {
        $customer = $request->get('portal_customer');

        // Find ONU linked to this customer (loose-link via fiber_onus.customer_id)
        $onu = \DB::table('fiber_onus')
            ->where('customer_id', $customer->id)
            ->first();

        if (!$onu) {
            return response()->json([
                'has_device' => false,
                'message' => 'No optical device assigned to your account. Please contact support.',
            ]);
        }

        $serial = $onu->serial_number;

        // Latest live status snapshot
        $live = \DB::table('onu_live_status')
            ->where('serial_number', $serial)
            ->orderBy('updated_at', 'desc')
            ->first();

        // 24h signal trend (max 96 points → ~15min spacing)
        $points = \DB::table('onu_signal_history')
            ->where('serial_number', $serial)
            ->where('recorded_at', '>=', now()->subHours(24))
            ->orderBy('recorded_at', 'asc')
            ->limit(200)
            ->get(['rx_power', 'tx_power', 'status', 'recorded_at']);

        // Last 5 outage events (offline/los/dying-gasp)
        $outages = \DB::table('onu_alert_logs')
            ->where('serial', $serial)
            ->whereIn('current_status', ['offline', 'los', 'dying-gasp'])
            ->orderBy('sent_at', 'desc')
            ->limit(5)
            ->get(['id', 'event_type', 'previous_status', 'current_status', 'sent_at']);

        // Compute uptime %% over last 24h (online points / total points)
        $uptimePct = null;
        if ($points->count() > 0) {
            $online = $points->where('status', 'online')->count();
            $uptimePct = round(($online / $points->count()) * 100, 1);
        }

        // Health verdict
        $verdict = 'unknown';
        if ($live) {
            if ($live->status === 'online') {
                $verdict = ($live->rx_power !== null && $live->rx_power < -27) ? 'degraded' : 'healthy';
            } elseif (in_array($live->status, ['los', 'dying-gasp'])) {
                $verdict = 'critical';
            } elseif ($live->status === 'offline') {
                $verdict = 'offline';
            }
        }

        return response()->json([
            'has_device' => true,
            'verdict' => $verdict,
            'serial' => $serial,
            'live' => $live ? [
                'status' => $live->status,
                'rx_power' => $live->rx_power !== null ? (float) $live->rx_power : null,
                'tx_power' => $live->tx_power !== null ? (float) $live->tx_power : null,
                'uptime' => $live->uptime,
                'last_seen' => $live->last_seen,
            ] : null,
            'uptime_24h_pct' => $uptimePct,
            'trend_points' => $points->map(fn ($p) => [
                'rx_power' => $p->rx_power !== null ? (float) $p->rx_power : null,
                'status' => $p->status,
                'recorded_at' => $p->recorded_at,
            ])->values(),
            'recent_outages' => $outages,
        ]);
    }
}


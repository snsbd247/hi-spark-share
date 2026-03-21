<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats()
    {
        $totalCustomers = Customer::count();
        $activeCustomers = Customer::where('status', 'active')->count();
        $suspendedCustomers = Customer::where('status', 'suspended')->count();

        $currentMonth = now()->format('Y-m');
        $totalBills = Bill::where('month', $currentMonth)->count();
        $paidBills = Bill::where('month', $currentMonth)->where('status', 'paid')->count();
        $unpaidBills = Bill::where('month', $currentMonth)->where('status', 'unpaid')->count();

        $totalRevenue = Payment::where('status', 'completed')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount');

        $totalCollection = Bill::where('month', $currentMonth)
            ->where('status', 'paid')
            ->sum('amount');

        $totalDue = Bill::where('month', $currentMonth)
            ->where('status', 'unpaid')
            ->sum('amount');

        return response()->json([
            'total_customers' => $totalCustomers,
            'active_customers' => $activeCustomers,
            'suspended_customers' => $suspendedCustomers,
            'total_bills' => $totalBills,
            'paid_bills' => $paidBills,
            'unpaid_bills' => $unpaidBills,
            'total_revenue' => (float) $totalRevenue,
            'total_collection' => (float) $totalCollection,
            'total_due' => (float) $totalDue,
            'current_month' => $currentMonth,
        ]);
    }
}

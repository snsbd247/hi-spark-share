import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import CustomerProtectedRoute from "@/components/CustomerProtectedRoute";
import SessionApprovalListener from "@/components/SessionApprovalListener";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Packages from "@/pages/Packages";
import Billing from "@/pages/Billing";
import BillingCycleOverview from "@/pages/BillingCycleOverview";
import Payments from "@/pages/Payments";
import MerchantPayments from "@/pages/MerchantPayments";
import MerchantPaymentReports from "@/pages/MerchantPaymentReports";
import Tickets from "@/pages/Tickets";
import SMSLogs from "@/pages/SMSLogs";
import SMSSettings from "@/pages/SMSSettings";
import ReminderLogs from "@/pages/ReminderLogs";
import PayBill from "@/pages/PayBill";
import AdminProfile from "@/pages/AdminProfile";
import GeneralSettings from "@/pages/settings/GeneralSettings";
import ZoneManagement from "@/pages/settings/ZoneManagement";
import MikroTikRouters from "@/pages/settings/MikroTikRouters";
import BkashApiManagement from "@/pages/settings/BkashApiManagement";
import NagadApiManagement from "@/pages/settings/NagadApiManagement";
import CustomerLogin from "@/pages/portal/CustomerLogin";
import CustomerDashboard from "@/pages/portal/CustomerDashboard";
import CustomerBills from "@/pages/portal/CustomerBills";
import CustomerPayments from "@/pages/portal/CustomerPayments";
import CustomerProfile from "@/pages/portal/CustomerProfile";
import CustomerTickets from "@/pages/portal/CustomerTickets";
import PaymentCallback from "@/pages/portal/PaymentCallback";
import AdminUsers from "@/pages/AdminUsers";
import CustomerProfilePage from "@/pages/CustomerProfile";
import LoginLogs from "@/pages/LoginLogs";
import SessionManagement from "@/pages/SessionManagement";
import AuditLogs from "@/pages/AuditLogs";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CustomerAuthProvider>
              <SessionApprovalListener />
              <Routes>
                {/* Admin Routes */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfilePage /></ProtectedRoute>} />
                <Route path="/packages" element={<ProtectedRoute><Packages /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/billing/cycle" element={<ProtectedRoute><BillingCycleOverview /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/merchant-payments" element={<ProtectedRoute><MerchantPayments /></ProtectedRoute>} />
                <Route path="/merchant-reports" element={<ProtectedRoute><MerchantPaymentReports /></ProtectedRoute>} />
                <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
                <Route path="/sms" element={<ProtectedRoute><SMSLogs /></ProtectedRoute>} />
                <Route path="/sms-settings" element={<ProtectedRoute><SMSSettings /></ProtectedRoute>} />
                <Route path="/reminders" element={<ProtectedRoute><ReminderLogs /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><AdminProfile /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
                <Route path="/login-logs" element={<ProtectedRoute><LoginLogs /></ProtectedRoute>} />
                <Route path="/sessions" element={<ProtectedRoute><SessionManagement /></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />

                {/* Settings Routes */}
                <Route path="/settings/general" element={<ProtectedRoute><GeneralSettings /></ProtectedRoute>} />
                <Route path="/settings/packages" element={<ProtectedRoute><Packages /></ProtectedRoute>} />
                <Route path="/settings/zones" element={<ProtectedRoute><ZoneManagement /></ProtectedRoute>} />
                <Route path="/settings/mikrotik" element={<ProtectedRoute><MikroTikRouters /></ProtectedRoute>} />
                <Route path="/settings/bkash" element={<ProtectedRoute><BkashApiManagement /></ProtectedRoute>} />
                <Route path="/settings/nagad" element={<ProtectedRoute><NagadApiManagement /></ProtectedRoute>} />

                {/* Public Payment Link */}
                <Route path="/pay" element={<PayBill />} />

                {/* Customer Routes */}
                <Route path="/login" element={<CustomerLogin />} />
                <Route path="/portal" element={<CustomerProtectedRoute><CustomerDashboard /></CustomerProtectedRoute>} />
                <Route path="/portal/bills" element={<CustomerProtectedRoute><CustomerBills /></CustomerProtectedRoute>} />
                <Route path="/portal/payments" element={<CustomerProtectedRoute><CustomerPayments /></CustomerProtectedRoute>} />
                <Route path="/portal/profile" element={<CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute>} />
                <Route path="/portal/tickets" element={<CustomerProtectedRoute><CustomerTickets /></CustomerProtectedRoute>} />
                <Route path="/portal/payment-callback" element={<PaymentCallback />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </CustomerAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

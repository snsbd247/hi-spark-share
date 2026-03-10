import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import CustomerProtectedRoute from "@/components/CustomerProtectedRoute";
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
import AuditLogs from "@/pages/AuditLogs";
import RoleManagement from "@/pages/settings/RoleManagement";
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
              <Routes>
                {/* Admin Routes */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/customers" element={<PermissionGuard module="customers"><Customers /></PermissionGuard>} />
                <Route path="/customers/:id" element={<PermissionGuard module="customers"><CustomerProfilePage /></PermissionGuard>} />
                <Route path="/packages" element={<ProtectedRoute><Packages /></ProtectedRoute>} />
                <Route path="/billing" element={<PermissionGuard module="billing"><Billing /></PermissionGuard>} />
                <Route path="/billing/cycle" element={<PermissionGuard module="billing"><BillingCycleOverview /></PermissionGuard>} />
                <Route path="/payments" element={<PermissionGuard module="payments"><Payments /></PermissionGuard>} />
                <Route path="/merchant-payments" element={<PermissionGuard module="merchant_payments"><MerchantPayments /></PermissionGuard>} />
                <Route path="/merchant-reports" element={<PermissionGuard module="reports"><MerchantPaymentReports /></PermissionGuard>} />
                <Route path="/tickets" element={<PermissionGuard module="tickets"><Tickets /></PermissionGuard>} />
                <Route path="/sms" element={<PermissionGuard module="sms"><SMSLogs /></PermissionGuard>} />
                <Route path="/sms-settings" element={<PermissionGuard module="sms" action="edit"><SMSSettings /></PermissionGuard>} />
                <Route path="/reminders" element={<PermissionGuard module="sms"><ReminderLogs /></PermissionGuard>} />
                <Route path="/profile" element={<ProtectedRoute><AdminProfile /></ProtectedRoute>} />
                <Route path="/users" element={<PermissionGuard module="users"><AdminUsers /></PermissionGuard>} />
                <Route path="/login-logs" element={<PermissionGuard module="settings"><LoginLogs /></PermissionGuard>} />
                <Route path="/audit-logs" element={<PermissionGuard module="settings"><AuditLogs /></PermissionGuard>} />

                {/* Settings Routes */}
                <Route path="/settings/general" element={<PermissionGuard module="settings"><GeneralSettings /></PermissionGuard>} />
                <Route path="/settings/packages" element={<PermissionGuard module="settings"><Packages /></PermissionGuard>} />
                <Route path="/settings/zones" element={<PermissionGuard module="settings"><ZoneManagement /></PermissionGuard>} />
                <Route path="/settings/mikrotik" element={<PermissionGuard module="settings"><MikroTikRouters /></PermissionGuard>} />
                <Route path="/settings/bkash" element={<PermissionGuard module="settings"><BkashApiManagement /></PermissionGuard>} />
                <Route path="/settings/nagad" element={<PermissionGuard module="settings"><NagadApiManagement /></PermissionGuard>} />
                <Route path="/settings/roles" element={<PermissionGuard module="roles"><RoleManagement /></PermissionGuard>} />

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

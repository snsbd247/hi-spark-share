import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import CustomerProtectedRoute from "@/components/CustomerProtectedRoute";
import SuperAdminGuard from "@/components/SuperAdminGuard";
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
import SystemSettings from "@/pages/settings/SystemSettings";
import ZoneManagement from "@/pages/settings/ZoneManagement";
import MikroTikRouters from "@/pages/settings/MikroTikRouters";
// BkashApiManagement and NagadApiManagement removed - managed centrally by Super Admin
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
import BackupRestore from "@/pages/settings/BackupRestore";
import SafeMode from "@/pages/SafeMode";
import SafeModeWrapper from "@/components/SafeModeWrapper";
import FooterSettings from "@/pages/settings/FooterSettings";
import NotFound from "@/pages/NotFound";

// Super Admin Pages
import SuperAdminLogin from "@/pages/super-admin/SuperAdminLogin";
import SuperAdminDashboard from "@/pages/super-admin/SuperAdminDashboard";
import TenantsManagement from "@/pages/super-admin/TenantsManagement";
import PlansManagement from "@/pages/super-admin/PlansManagement";
import SubscriptionsManagement from "@/pages/super-admin/SubscriptionsManagement";
import PlatformMonitoring from "@/pages/super-admin/PlatformMonitoring";
import SuperAdminSystemSettings from "@/pages/super-admin/SuperAdminSystemSettings";
import SuperAdminAuditLogs from "@/pages/super-admin/SuperAdminAuditLogs";
import SuperAdminPayments from "@/pages/super-admin/SuperAdminPayments";
import SuperAdminBackup from "@/pages/super-admin/SuperAdminBackup";
import SuperAdminIntegrations from "@/pages/super-admin/SuperAdminIntegrations";
import TenantIntegrations from "@/pages/super-admin/TenantIntegrations";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        if (error?.kind === "auth" || error?.kind === "permission") return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CustomerAuthProvider>
              <TenantProvider>
              <SafeModeWrapper>
              <Routes>
                {/* Super Admin Routes */}
                <Route path="/super-admin/login" element={<SuperAdminLogin />} />
                <Route path="/super-admin" element={<SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard>} />
                <Route path="/super-admin/dashboard" element={<SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard>} />
                <Route path="/super-admin/tenants" element={<SuperAdminGuard><TenantsManagement /></SuperAdminGuard>} />
                <Route path="/super-admin/tenants/:tenantId/integrations" element={<SuperAdminGuard><TenantIntegrations /></SuperAdminGuard>} />
                <Route path="/super-admin/plans" element={<SuperAdminGuard><PlansManagement /></SuperAdminGuard>} />
                <Route path="/super-admin/subscriptions" element={<SuperAdminGuard><SubscriptionsManagement /></SuperAdminGuard>} />
                <Route path="/super-admin/monitoring" element={<SuperAdminGuard><PlatformMonitoring /></SuperAdminGuard>} />
                <Route path="/super-admin/settings" element={<SuperAdminGuard><SuperAdminSystemSettings /></SuperAdminGuard>} />
                <Route path="/super-admin/payments" element={<SuperAdminGuard><SuperAdminPayments /></SuperAdminGuard>} />
                <Route path="/super-admin/audit-logs" element={<SuperAdminGuard><SuperAdminAuditLogs /></SuperAdminGuard>} />
                <Route path="/super-admin/integrations" element={<SuperAdminGuard><SuperAdminIntegrations /></SuperAdminGuard>} />
                <Route path="/super-admin/backup" element={<SuperAdminGuard><SuperAdminBackup /></SuperAdminGuard>} />

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
                <Route path="/settings/system" element={<PermissionGuard module="settings"><SystemSettings /></PermissionGuard>} />
                <Route path="/settings/packages" element={<PermissionGuard module="settings"><Packages /></PermissionGuard>} />
                <Route path="/settings/zones" element={<PermissionGuard module="settings"><ZoneManagement /></PermissionGuard>} />
                <Route path="/settings/mikrotik" element={<PermissionGuard module="settings"><MikroTikRouters /></PermissionGuard>} />
                {/* bKash and Nagad settings removed - managed centrally by Super Admin */}
                <Route path="/settings/roles" element={<PermissionGuard module="roles"><RoleManagement /></PermissionGuard>} />
                <Route path="/settings/footer" element={<PermissionGuard module="settings"><FooterSettings /></PermissionGuard>} />
                <Route path="/settings/backup" element={<PermissionGuard module="settings"><BackupRestore /></PermissionGuard>} />
                <Route path="/safe-mode" element={<ProtectedRoute><SafeMode onDismiss={() => window.location.href = "/"} /></ProtectedRoute>} />

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
              </SafeModeWrapper>
              </TenantProvider>
            </CustomerAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SuperAdminProvider } from "@/contexts/SuperAdminContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import CustomerProtectedRoute from "@/components/CustomerProtectedRoute";
import ResellerProtectedRoute from "@/components/ResellerProtectedRoute";
import { ResellerAuthProvider } from "@/contexts/ResellerAuthContext";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// ── Lazy-loaded pages ──────────────────────────────────────
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Customers = lazy(() => import("@/pages/Customers"));
const Packages = lazy(() => import("@/pages/Packages"));
const Billing = lazy(() => import("@/pages/Billing"));
const BillingCycleOverview = lazy(() => import("@/pages/BillingCycleOverview"));
const Payments = lazy(() => import("@/pages/Payments"));
const MerchantPayments = lazy(() => import("@/pages/MerchantPayments"));
const MerchantPaymentReports = lazy(() => import("@/pages/MerchantPaymentReports"));
const Tickets = lazy(() => import("@/pages/Tickets"));
const SMSLogs = lazy(() => import("@/pages/SMSLogs"));
const ReminderLogs = lazy(() => import("@/pages/ReminderLogs"));
const PayBill = lazy(() => import("@/pages/PayBill"));
const AdminProfile = lazy(() => import("@/pages/AdminProfile"));
const GeneralSettings = lazy(() => import("@/pages/settings/GeneralSettings"));
const SystemSettings = lazy(() => import("@/pages/settings/SystemSettings"));
const IntegrationManagement = lazy(() => import("@/pages/settings/IntegrationManagement"));
const MikroTikRouters = lazy(() => import("@/pages/settings/MikroTikRouters"));
const CustomerLogin = lazy(() => import("@/pages/portal/CustomerLogin"));
const CustomerDashboard = lazy(() => import("@/pages/portal/CustomerDashboard"));
const CustomerBills = lazy(() => import("@/pages/portal/CustomerBills"));
const CustomerPayments = lazy(() => import("@/pages/portal/CustomerPayments"));
const CustomerProfile = lazy(() => import("@/pages/portal/CustomerProfile"));
const CustomerTickets = lazy(() => import("@/pages/portal/CustomerTickets"));
const PaymentCallback = lazy(() => import("@/pages/portal/PaymentCallback"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const CustomerProfilePage = lazy(() => import("@/pages/CustomerProfile"));
const LoginLogs = lazy(() => import("@/pages/LoginLogs"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const ActivityLogs = lazy(() => import("@/pages/ActivityLogs"));
const UserLoginHistory = lazy(() => import("@/pages/UserLoginHistory"));
const SessionManagement = lazy(() => import("@/pages/SessionManagement"));
const SecurityDashboard = lazy(() => import("@/pages/SecurityDashboard"));
const RoleManagement = lazy(() => import("@/pages/settings/RoleManagement"));
const FooterSettings = lazy(() => import("@/pages/settings/FooterSettings"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const SmartHomeRoute = lazy(() => import("@/components/SmartHomeRoute"));
const AccPurchases = lazy(() => import("@/pages/accounting/Purchases"));
const AccountingDashboard = lazy(() => import("@/pages/accounting/AccountingDashboard"));
const AccProducts = lazy(() => import("@/pages/accounting/Products"));
const AccSales = lazy(() => import("@/pages/accounting/Sales"));
const AccExpenses = lazy(() => import("@/pages/accounting/Expenses"));
const AccReports = lazy(() => import("@/pages/accounting/Reports"));
const ChartOfAccounts = lazy(() => import("@/pages/accounting/ChartOfAccounts"));
const BalanceSheet = lazy(() => import("@/pages/accounting/BalanceSheet"));
const JournalEntries = lazy(() => import("@/pages/accounting/JournalEntries"));
const LedgerStatement = lazy(() => import("@/pages/accounting/LedgerStatement"));
const ReportLedgerStatement = lazy(() => import("@/pages/reporting/LedgerStatement"));
const IncomeHead = lazy(() => import("@/pages/accounting/IncomeHead"));
const ExpenseHead = lazy(() => import("@/pages/accounting/ExpenseHead"));
const OthersHead = lazy(() => import("@/pages/accounting/OthersHead"));
const AllTransactions = lazy(() => import("@/pages/accounting/AllTransactions"));
const AllLedgersList = lazy(() => import("@/pages/accounting/AllLedgersList"));
const ChequeRegister = lazy(() => import("@/pages/accounting/ChequeRegister"));
const TrialBalance = lazy(() => import("@/pages/accounting/TrialBalance"));
const ProfitLoss = lazy(() => import("@/pages/accounting/ProfitLoss"));
const CashFlowStatement = lazy(() => import("@/pages/accounting/CashFlowStatement"));
const Daybook = lazy(() => import("@/pages/accounting/Daybook"));
const EquityChanges = lazy(() => import("@/pages/accounting/EquityChanges"));
const ReceivablePayable = lazy(() => import("@/pages/accounting/ReceivablePayable"));
const SalesPurchaseReport = lazy(() => import("@/pages/reporting/SalesPurchaseReport"));
const DesignationList = lazy(() => import("@/pages/hr/DesignationList"));
const EmployeeList = lazy(() => import("@/pages/hr/EmployeeList"));
const DailyAttendance = lazy(() => import("@/pages/hr/DailyAttendance"));
const MonthlyAttendance = lazy(() => import("@/pages/hr/MonthlyAttendance"));
const LoanManagement = lazy(() => import("@/pages/hr/LoanManagement"));
const SalarySheet = lazy(() => import("@/pages/hr/SalarySheet"));
const EmployeeProfile = lazy(() => import("@/pages/hr/EmployeeProfile"));
const SupplierList = lazy(() => import("@/pages/supplier/SupplierList"));
const SupplierPayments = lazy(() => import("@/pages/supplier/SupplierPayments"));
const SupplierProfile = lazy(() => import("@/pages/supplier/SupplierProfile"));
const SupplierPurchases = lazy(() => import("@/pages/supplier/SupplierPurchases"));
const DailyReport = lazy(() => import("@/pages/reporting/DailyReport"));
const FinancialStatement = lazy(() => import("@/pages/reporting/FinancialStatement"));
const BtrcReport = lazy(() => import("@/pages/reporting/BtrcReport"));
const TrafficMonitor = lazy(() => import("@/pages/reporting/TrafficMonitor"));
const RevenueReport = lazy(() => import("@/pages/reporting/RevenueReport"));
const ExpenseReport = lazy(() => import("@/pages/reporting/ExpenseReport"));
const ProfitLossReport = lazy(() => import("@/pages/reporting/ProfitLossReport"));
const CashFlowReport = lazy(() => import("@/pages/reporting/CashFlowReport"));
const TrialBalanceReport = lazy(() => import("@/pages/reporting/TrialBalanceReport"));
const BalanceSheetReport = lazy(() => import("@/pages/reporting/BalanceSheetReport"));
const ReceivablePayableReport = lazy(() => import("@/pages/reporting/ReceivablePayableReport"));
const InventoryReport = lazy(() => import("@/pages/reporting/InventoryReport"));
const ApiHealthMonitor = lazy(() => import("@/pages/settings/ApiHealthMonitor"));
const GeoManagement = lazy(() => import("@/pages/settings/GeoManagement"));
const DomainManagement = lazy(() => import("@/pages/settings/DomainManagement"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const DemoRequestPage = lazy(() => import("@/pages/DemoRequestPage"));
const ForcePasswordChange = lazy(() => import("@/pages/ForcePasswordChange"));
const CouponManagement = lazy(() => import("@/pages/CouponManagement"));
const ResellerManagement = lazy(() => import("@/pages/ResellerManagement"));
const ResellerProfitReport = lazy(() => import("@/pages/ResellerProfitReport"));
const IpPoolManagement = lazy(() => import("@/pages/IpPoolManagement"));
const FaqManagement = lazy(() => import("@/pages/FaqManagement"));
const AdvancedAnalytics = lazy(() => import("@/pages/AdvancedAnalytics"));
const SubscriptionInvoices = lazy(() => import("@/pages/settings/SubscriptionInvoices"));
const InventoryDashboard = lazy(() => import("@/pages/inventory/InventoryDashboard"));
const InventoryCategories = lazy(() => import("@/pages/inventory/Categories"));
const ProductSerials = lazy(() => import("@/pages/inventory/ProductSerials"));
const CustomerDevices = lazy(() => import("@/pages/inventory/CustomerDevices"));
const InventoryLogs = lazy(() => import("@/pages/inventory/InventoryLogs"));
const NetworkMap = lazy(() => import("@/pages/NetworkMap"));
const FiberTopology = lazy(() => import("@/pages/FiberTopology"));
const SuperAdminLogin = lazy(() => import("@/pages/super/SuperAdminLogin"));
const ResellerLogin = lazy(() => import("@/pages/reseller/ResellerLogin"));
const ResellerDashboard = lazy(() => import("@/pages/reseller/ResellerDashboard"));
const ResellerCustomers = lazy(() => import("@/pages/reseller/ResellerCustomers"));
const ResellerBilling = lazy(() => import("@/pages/reseller/ResellerBilling"));
const ResellerWallet = lazy(() => import("@/pages/reseller/ResellerWallet"));
const ResellerReports = lazy(() => import("@/pages/reseller/ResellerReports"));
const ResellerProfile = lazy(() => import("@/pages/reseller/ResellerProfile"));
const ResellerZones = lazy(() => import("@/pages/reseller/ResellerZones"));
const ResellerBandwidth = lazy(() => import("@/pages/reseller/ResellerBandwidth"));
const BandwidthAnalytics = lazy(() => import("@/pages/BandwidthAnalytics"));
const LiveBandwidth = lazy(() => import("@/pages/LiveBandwidth"));
const ResellerLiveBandwidth = lazy(() => import("@/pages/reseller/ResellerLiveBandwidth"));
const CustomerPortalBandwidth = lazy(() => import("@/pages/portal/CustomerPortalBandwidth"));
const SuperAdminLayout = lazy(() => import("@/components/super/SuperAdminLayout"));
const SuperDashboard = lazy(() => import("@/pages/super/SuperDashboard"));
const SuperTenants = lazy(() => import("@/pages/super/SuperTenants"));
const SuperTenantProfile = lazy(() => import("@/pages/super/SuperTenantProfile"));
const SuperOnboarding = lazy(() => import("@/pages/super/SuperOnboarding"));
const SuperPlans = lazy(() => import("@/pages/super/SuperPlans"));
const SuperSubscriptions = lazy(() => import("@/pages/super/SuperSubscriptions"));
const SuperBilling = lazy(() => import("@/pages/super/SuperBilling"));
const SuperDomains = lazy(() => import("@/pages/super/SuperDomains"));
const SuperSmsManagement = lazy(() => import("@/pages/super/SuperSmsManagement"));
const SuperAnalytics = lazy(() => import("@/pages/super/SuperAnalytics"));
const SuperSmtpSettings = lazy(() => import("@/pages/super/SuperSmtpSettings"));
const SuperBranding = lazy(() => import("@/pages/super/SuperBranding"));
const SuperUsers = lazy(() => import("@/pages/super/SuperUsers"));
const SuperRoles = lazy(() => import("@/pages/super/SuperRoles"));
const SuperActivityLogs = lazy(() => import("@/pages/super/SuperActivityLogs"));
const SuperLandingCMS = lazy(() => import("@/pages/super/SuperLandingCMS"));
const SuperDemoRequests = lazy(() => import("@/pages/super/SuperDemoRequests"));
const SuperBackupRecovery = lazy(() => import("@/pages/super/SuperBackupRecovery"));
const SuperContactMessages = lazy(() => import("@/pages/super/SuperContactMessages"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

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
            <LanguageProvider>
            <CustomerAuthProvider>
            <ResellerAuthProvider>
            <SuperAdminProvider>
              <BrandingProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Admin Routes */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/demo-request" element={<DemoRequestPage />} />
                <Route path="/" element={<SmartHomeRoute />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/customers" element={<PermissionGuard module="customers"><Customers /></PermissionGuard>} />
                <Route path="/customers/:id" element={<PermissionGuard module="customers"><CustomerProfilePage /></PermissionGuard>} />
                <Route path="/packages" element={<PermissionGuard module="settings"><Packages /></PermissionGuard>} />
                <Route path="/billing" element={<PermissionGuard module="billing"><Billing /></PermissionGuard>} />
                <Route path="/billing/cycle" element={<PermissionGuard module="billing"><BillingCycleOverview /></PermissionGuard>} />
                <Route path="/payments" element={<PermissionGuard module="payments"><Payments /></PermissionGuard>} />
                <Route path="/merchant-payments" element={<PermissionGuard module="merchant_payments"><MerchantPayments /></PermissionGuard>} />
                <Route path="/merchant-reports" element={<PermissionGuard module="reports"><MerchantPaymentReports /></PermissionGuard>} />
                <Route path="/tickets" element={<PermissionGuard module="tickets"><Tickets /></PermissionGuard>} />
                <Route path="/sms" element={<PermissionGuard module="sms"><SMSLogs /></PermissionGuard>} />
                <Route path="/reminders" element={<PermissionGuard module="sms"><ReminderLogs /></PermissionGuard>} />
                <Route path="/profile" element={<ProtectedRoute><AdminProfile /></ProtectedRoute>} />
                <Route path="/users" element={<PermissionGuard module="users"><AdminUsers /></PermissionGuard>} />
                <Route path="/login-logs" element={<PermissionGuard module="settings"><LoginLogs /></PermissionGuard>} />
                <Route path="/audit-logs" element={<PermissionGuard module="settings"><AuditLogs /></PermissionGuard>} />
                <Route path="/activity-logs" element={<PermissionGuard module="settings"><ActivityLogs /></PermissionGuard>} />
                <Route path="/login-history" element={<PermissionGuard module="settings"><UserLoginHistory /></PermissionGuard>} />
                <Route path="/sessions" element={<PermissionGuard module="settings"><SessionManagement /></PermissionGuard>} />
                <Route path="/security" element={<PermissionGuard module="settings"><SecurityDashboard /></PermissionGuard>} />

                {/* HR Routes */}
                <Route path="/hr/designations" element={<PermissionGuard module="hr"><DesignationList /></PermissionGuard>} />
                <Route path="/hr/employees" element={<PermissionGuard module="hr"><EmployeeList /></PermissionGuard>} />
                <Route path="/hr/employees/:id" element={<PermissionGuard module="hr"><EmployeeProfile /></PermissionGuard>} />
                <Route path="/hr/daily-attendance" element={<PermissionGuard module="hr"><DailyAttendance /></PermissionGuard>} />
                <Route path="/hr/monthly-attendance" element={<PermissionGuard module="hr"><MonthlyAttendance /></PermissionGuard>} />
                <Route path="/hr/loans" element={<PermissionGuard module="hr"><LoanManagement /></PermissionGuard>} />
                <Route path="/hr/salary" element={<PermissionGuard module="hr"><SalarySheet /></PermissionGuard>} />

                {/* Accounting Routes */}
                <Route path="/accounting" element={<PermissionGuard module="accounting"><AccountingDashboard /></PermissionGuard>} />
                <Route path="/accounting/chart-of-accounts" element={<PermissionGuard module="accounting"><ChartOfAccounts /></PermissionGuard>} />
                <Route path="/accounting/balance-sheet" element={<PermissionGuard module="accounting"><BalanceSheet /></PermissionGuard>} />
                <Route path="/accounting/journal-entries" element={<PermissionGuard module="accounting"><JournalEntries /></PermissionGuard>} />
                <Route path="/accounting/ledger-statement" element={<PermissionGuard module="accounting"><LedgerStatement /></PermissionGuard>} />
                <Route path="/accounting/income-head" element={<PermissionGuard module="accounting"><IncomeHead /></PermissionGuard>} />
                <Route path="/accounting/expense-head" element={<PermissionGuard module="accounting"><ExpenseHead /></PermissionGuard>} />
                <Route path="/accounting/others-head" element={<PermissionGuard module="accounting"><OthersHead /></PermissionGuard>} />
                <Route path="/accounting/transactions" element={<PermissionGuard module="accounting"><AllTransactions /></PermissionGuard>} />
                <Route path="/accounting/all-ledgers" element={<PermissionGuard module="accounting"><AllLedgersList /></PermissionGuard>} />
                <Route path="/accounting/cheque-register" element={<PermissionGuard module="accounting"><ChequeRegister /></PermissionGuard>} />
                <Route path="/accounting/trial-balance" element={<PermissionGuard module="accounting"><TrialBalance /></PermissionGuard>} />
                <Route path="/accounting/profit-loss" element={<PermissionGuard module="accounting"><ProfitLoss /></PermissionGuard>} />
                <Route path="/accounting/cash-flow" element={<PermissionGuard module="accounting"><CashFlowStatement /></PermissionGuard>} />
                <Route path="/accounting/equity-changes" element={<PermissionGuard module="accounting"><EquityChanges /></PermissionGuard>} />
                <Route path="/accounting/daybook" element={<PermissionGuard module="accounting"><Daybook /></PermissionGuard>} />
                <Route path="/accounting/receivable-payable" element={<PermissionGuard module="accounting"><ReceivablePayable /></PermissionGuard>} />
                
                <Route path="/accounting/products" element={<PermissionGuard module="inventory"><AccProducts /></PermissionGuard>} />
                <Route path="/accounting/purchases" element={<PermissionGuard module="accounting"><AccPurchases /></PermissionGuard>} />
                <Route path="/accounting/sales" element={<PermissionGuard module="inventory"><AccSales /></PermissionGuard>} />
                <Route path="/accounting/expenses" element={<PermissionGuard module="accounting"><AccExpenses /></PermissionGuard>} />
                <Route path="/accounting/reports" element={<PermissionGuard module="accounting"><AccReports /></PermissionGuard>} />

                {/* Inventory Routes */}
                <Route path="/inventory" element={<PermissionGuard module="inventory"><InventoryDashboard /></PermissionGuard>} />
                <Route path="/inventory/products" element={<PermissionGuard module="inventory"><AccProducts /></PermissionGuard>} />
                <Route path="/inventory/categories" element={<PermissionGuard module="inventory"><InventoryCategories /></PermissionGuard>} />
                <Route path="/inventory/serials" element={<PermissionGuard module="inventory"><ProductSerials /></PermissionGuard>} />
                <Route path="/inventory/devices" element={<PermissionGuard module="inventory"><CustomerDevices /></PermissionGuard>} />
                <Route path="/inventory/logs" element={<PermissionGuard module="inventory"><InventoryLogs /></PermissionGuard>} />
                <Route path="/inventory/sales" element={<PermissionGuard module="inventory"><AccSales /></PermissionGuard>} />

                <Route path="/supplier/list" element={<PermissionGuard module="supplier"><SupplierList /></PermissionGuard>} />
                <Route path="/supplier/:id" element={<PermissionGuard module="supplier"><SupplierProfile /></PermissionGuard>} />
                <Route path="/supplier/purchases" element={<PermissionGuard module="supplier"><SupplierPurchases /></PermissionGuard>} />
                <Route path="/supplier/payments" element={<PermissionGuard module="supplier"><SupplierPayments /></PermissionGuard>} />

                {/* Reporting Routes */}
                <Route path="/reporting/daily" element={<PermissionGuard module="reports"><DailyReport /></PermissionGuard>} />
                <Route path="/reporting/financial" element={<PermissionGuard module="reports"><FinancialStatement /></PermissionGuard>} />
                <Route path="/reporting/btrc" element={<PermissionGuard module="reports"><BtrcReport /></PermissionGuard>} />
                <Route path="/reporting/traffic" element={<PermissionGuard module="reports"><TrafficMonitor /></PermissionGuard>} />
                <Route path="/reporting/sales-purchase" element={<PermissionGuard module="reports"><SalesPurchaseReport /></PermissionGuard>} />
                <Route path="/reporting/ledger-statement" element={<PermissionGuard module="reports"><ReportLedgerStatement /></PermissionGuard>} />
                <Route path="/reporting/revenue" element={<PermissionGuard module="reports"><RevenueReport /></PermissionGuard>} />
                <Route path="/reporting/expense" element={<PermissionGuard module="reports"><ExpenseReport /></PermissionGuard>} />
                <Route path="/reporting/profit-loss" element={<PermissionGuard module="reports"><ProfitLossReport /></PermissionGuard>} />
                <Route path="/reporting/cash-flow" element={<PermissionGuard module="reports"><CashFlowReport /></PermissionGuard>} />
                <Route path="/reporting/trial-balance" element={<PermissionGuard module="reports"><TrialBalanceReport /></PermissionGuard>} />
                <Route path="/reporting/balance-sheet" element={<PermissionGuard module="reports"><BalanceSheetReport /></PermissionGuard>} />
                <Route path="/reporting/receivable-payable" element={<PermissionGuard module="reports"><ReceivablePayableReport /></PermissionGuard>} />
                <Route path="/reporting/inventory" element={<PermissionGuard module="reports"><InventoryReport /></PermissionGuard>} />

                {/* Settings Routes */}
                <Route path="/settings/general" element={<PermissionGuard module="settings"><GeneralSettings /></PermissionGuard>} />
                <Route path="/settings/system" element={<PermissionGuard module="settings"><SystemSettings /></PermissionGuard>} />
                <Route path="/settings/packages" element={<PermissionGuard module="settings"><Packages /></PermissionGuard>} />
                <Route path="/settings/locations" element={<PermissionGuard module="settings"><GeoManagement /></PermissionGuard>} />
                <Route path="/settings/mikrotik" element={<PermissionGuard module="settings"><MikroTikRouters /></PermissionGuard>} />
                <Route path="/settings/roles" element={<PermissionGuard module="roles"><RoleManagement /></PermissionGuard>} />
                <Route path="/settings/footer" element={<PermissionGuard module="settings"><FooterSettings /></PermissionGuard>} />
                <Route path="/settings/integrations" element={<PermissionGuard module="settings"><IntegrationManagement /></PermissionGuard>} />
                
                <Route path="/settings/api-health" element={<PermissionGuard module="settings"><ApiHealthMonitor /></PermissionGuard>} />
                <Route path="/settings/domains" element={<PermissionGuard module="settings"><DomainManagement /></PermissionGuard>} />
                <Route path="/settings/subscription" element={<ProtectedRoute><SubscriptionInvoices /></ProtectedRoute>} />
                <Route path="/coupons" element={<PermissionGuard module="billing"><CouponManagement /></PermissionGuard>} />
                <Route path="/ip-pools" element={<PermissionGuard module="settings"><IpPoolManagement /></PermissionGuard>} />
                <Route path="/faq" element={<PermissionGuard module="settings"><FaqManagement /></PermissionGuard>} />
                <Route path="/analytics" element={<PermissionGuard module="reports"><AdvancedAnalytics /></PermissionGuard>} />
                <Route path="/resellers" element={<PermissionGuard module="reseller"><ResellerManagement /></PermissionGuard>} />
                <Route path="/reseller-profit-report" element={<PermissionGuard module="reseller"><ResellerProfitReport /></PermissionGuard>} />
                <Route path="/bandwidth-analytics" element={<PermissionGuard module="reports"><BandwidthAnalytics /></PermissionGuard>} />
                <Route path="/live-bandwidth" element={<PermissionGuard module="reports"><LiveBandwidth /></PermissionGuard>} />

                {/* Network Topology */}
                <Route path="/network-map" element={<PermissionGuard module="network_map"><NetworkMap /></PermissionGuard>} />
                <Route path="/fiber-topology" element={<PermissionGuard module="fiber_network"><FiberTopology /></PermissionGuard>} />

                {/* Public Payment Link */}
                <Route path="/pay" element={<PayBill />} />

                {/* Force Password Change */}
                <Route path="/force-password-change" element={<ForcePasswordChange />} />

                {/* Super Admin Routes */}
                <Route path="/super" element={<Outlet />}>
                  <Route path="login" element={<SuperAdminLogin />} />
                  <Route element={<SuperAdminLayout />}>
                    <Route path="dashboard" element={<SuperDashboard />} />
                    <Route path="tenants" element={<SuperTenants />} />
                    <Route path="tenants/:id" element={<SuperTenantProfile />} />
                    <Route path="onboarding" element={<SuperOnboarding />} />
                    <Route path="plans" element={<SuperPlans />} />
                    <Route path="subscriptions" element={<SuperSubscriptions />} />
                    <Route path="billing" element={<SuperBilling />} />
                    <Route path="domains" element={<SuperDomains />} />
                    <Route path="branding" element={<SuperBranding />} />
                    <Route path="sms" element={<SuperSmsManagement />} />
                    <Route path="smtp" element={<SuperSmtpSettings />} />
                    <Route path="analytics" element={<SuperAnalytics />} />
                    <Route path="users" element={<SuperUsers />} />
                    <Route path="roles" element={<SuperRoles />} />
                    <Route path="roles-permissions" element={<SuperRoles />} />
                    <Route path="activity-logs" element={<SuperActivityLogs />} />
                    <Route path="landing-cms" element={<SuperLandingCMS />} />
                    <Route path="demo-requests" element={<SuperDemoRequests />} />
                    <Route path="backup-recovery" element={<SuperBackupRecovery />} />
                    <Route path="contact-messages" element={<SuperContactMessages />} />
                  </Route>
                </Route>

                {/* Customer Portal */}
                <Route path="/login" element={<CustomerLogin />} />
                <Route path="/portal/login" element={<CustomerLogin />} />
                <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
                <Route path="/portal/dashboard" element={<CustomerProtectedRoute><CustomerDashboard /></CustomerProtectedRoute>} />
                <Route path="/portal/bills" element={<CustomerProtectedRoute><CustomerBills /></CustomerProtectedRoute>} />
                <Route path="/portal/payments" element={<CustomerProtectedRoute><CustomerPayments /></CustomerProtectedRoute>} />
                <Route path="/portal/profile" element={<CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute>} />
                <Route path="/portal/tickets" element={<CustomerProtectedRoute><CustomerTickets /></CustomerProtectedRoute>} />
                <Route path="/portal/bandwidth" element={<CustomerProtectedRoute><CustomerPortalBandwidth /></CustomerProtectedRoute>} />
                <Route path="/portal/payment/callback" element={<CustomerProtectedRoute><PaymentCallback /></CustomerProtectedRoute>} />

                {/* Reseller Portal */}
                <Route path="/reseller/login" element={<ResellerLogin />} />
                <Route path="/reseller/dashboard" element={<ResellerProtectedRoute><ResellerDashboard /></ResellerProtectedRoute>} />
                <Route path="/reseller/customers" element={<ResellerProtectedRoute><ResellerCustomers /></ResellerProtectedRoute>} />
                <Route path="/reseller/zones" element={<ResellerProtectedRoute><ResellerZones /></ResellerProtectedRoute>} />
                <Route path="/reseller/billing" element={<ResellerProtectedRoute><ResellerBilling /></ResellerProtectedRoute>} />
                <Route path="/reseller/bandwidth" element={<ResellerProtectedRoute><ResellerBandwidth /></ResellerProtectedRoute>} />
                <Route path="/reseller/live-bandwidth" element={<ResellerProtectedRoute><ResellerLiveBandwidth /></ResellerProtectedRoute>} />
                <Route path="/reseller/wallet" element={<ResellerProtectedRoute><ResellerWallet /></ResellerProtectedRoute>} />
                <Route path="/reseller/reports" element={<ResellerProtectedRoute><ResellerReports /></ResellerProtectedRoute>} />
                <Route path="/reseller/profile" element={<ResellerProtectedRoute><ResellerProfile /></ResellerProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </BrandingProvider>
            </SuperAdminProvider>
            </ResellerAuthProvider>
            </CustomerAuthProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

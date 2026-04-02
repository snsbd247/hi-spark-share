import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import CustomerProtectedRoute from "@/components/CustomerProtectedRoute";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// ── Page-level loading fallback ──
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

// ── Lazy loaded pages ──
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
// SMSSettings removed from tenant - now Super Admin only
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
const BackupRestore = lazy(() => import("@/pages/settings/BackupRestore"));
const FooterSettings = lazy(() => import("@/pages/settings/FooterSettings"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AccPurchases = lazy(() => import("@/pages/accounting/Purchases"));
const AccProducts = lazy(() => import("@/pages/accounting/Products"));
const AccVendors = lazy(() => import("@/pages/accounting/Vendors"));
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
const ApiHealthMonitor = lazy(() => import("@/pages/settings/ApiHealthMonitor"));
const GeoManagement = lazy(() => import("@/pages/settings/GeoManagement"));
const DomainManagement = lazy(() => import("@/pages/settings/DomainManagement"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ForcePasswordChange = lazy(() => import("@/pages/ForcePasswordChange"));
const CouponManagement = lazy(() => import("@/pages/CouponManagement"));
const IpPoolManagement = lazy(() => import("@/pages/IpPoolManagement"));
const FaqManagement = lazy(() => import("@/pages/FaqManagement"));
const AdvancedAnalytics = lazy(() => import("@/pages/AdvancedAnalytics"));

// Inventory module
const InventoryDashboard = lazy(() => import("@/pages/inventory/InventoryDashboard"));
const InventoryCategories = lazy(() => import("@/pages/inventory/Categories"));
const ProductSerials = lazy(() => import("@/pages/inventory/ProductSerials"));
const CustomerDevices = lazy(() => import("@/pages/inventory/CustomerDevices"));
const InventoryLogs = lazy(() => import("@/pages/inventory/InventoryLogs"));

// Super Admin (separate chunk)
import { SuperAdminProvider } from "@/contexts/SuperAdminContext";
const SuperAdminLogin = lazy(() => import("@/pages/super/SuperAdminLogin"));
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
              <BrandingProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Admin Routes */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
                <Route path="/accounting/vendors" element={<PermissionGuard module="accounting"><AccVendors /></PermissionGuard>} />
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

                {/* Settings Routes */}
                <Route path="/settings/general" element={<PermissionGuard module="settings"><GeneralSettings /></PermissionGuard>} />
                <Route path="/settings/system" element={<PermissionGuard module="settings"><SystemSettings /></PermissionGuard>} />
                <Route path="/settings/packages" element={<PermissionGuard module="settings"><Packages /></PermissionGuard>} />
                <Route path="/settings/locations" element={<PermissionGuard module="settings"><GeoManagement /></PermissionGuard>} />
                <Route path="/settings/mikrotik" element={<PermissionGuard module="settings"><MikroTikRouters /></PermissionGuard>} />
                <Route path="/settings/roles" element={<PermissionGuard module="roles"><RoleManagement /></PermissionGuard>} />
                <Route path="/settings/footer" element={<PermissionGuard module="settings"><FooterSettings /></PermissionGuard>} />
                <Route path="/settings/integrations" element={<PermissionGuard module="settings"><IntegrationManagement /></PermissionGuard>} />
                <Route path="/settings/backup" element={<PermissionGuard module="settings"><BackupRestore /></PermissionGuard>} />
                <Route path="/settings/api-health" element={<PermissionGuard module="settings"><ApiHealthMonitor /></PermissionGuard>} />
                <Route path="/settings/domains" element={<PermissionGuard module="settings"><DomainManagement /></PermissionGuard>} />
                <Route path="/coupons" element={<PermissionGuard module="billing"><CouponManagement /></PermissionGuard>} />
                <Route path="/ip-pools" element={<PermissionGuard module="settings"><IpPoolManagement /></PermissionGuard>} />
                <Route path="/faq" element={<PermissionGuard module="settings"><FaqManagement /></PermissionGuard>} />
                <Route path="/analytics" element={<PermissionGuard module="reports"><AdvancedAnalytics /></PermissionGuard>} />

                {/* Public Payment Link */}
                <Route path="/pay" element={<PayBill />} />

                {/* Force Password Change */}
                <Route path="/force-password-change" element={<ForcePasswordChange />} />

                {/* Super Admin Routes */}
                <Route path="/super/login" element={<SuperAdminProvider><SuperAdminLogin /></SuperAdminProvider>} />
                <Route path="/super" element={<SuperAdminProvider><SuperAdminLayout /></SuperAdminProvider>}>
                  <Route path="dashboard" element={<SuperDashboard />} />
                  <Route path="tenants" element={<SuperTenants />} />
                  <Route path="tenants/:id" element={<SuperTenantProfile />} />
                  <Route path="onboarding" element={<SuperOnboarding />} />
                  <Route path="plans" element={<SuperPlans />} />
                  <Route path="subscriptions" element={<SuperSubscriptions />} />
                  <Route path="billing" element={<SuperBilling />} />
                  <Route path="domains" element={<SuperDomains />} />
                  <Route path="sms" element={<SuperSmsManagement />} />
                  <Route path="smtp" element={<SuperSmtpSettings />} />
                  <Route path="analytics" element={<SuperAnalytics />} />
                </Route>

                {/* Customer Portal */}
                <Route path="/login" element={<CustomerLogin />} />
                <Route path="/portal/dashboard" element={<CustomerProtectedRoute><CustomerDashboard /></CustomerProtectedRoute>} />
                <Route path="/portal/bills" element={<CustomerProtectedRoute><CustomerBills /></CustomerProtectedRoute>} />
                <Route path="/portal/payments" element={<CustomerProtectedRoute><CustomerPayments /></CustomerProtectedRoute>} />
                <Route path="/portal/profile" element={<CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute>} />
                <Route path="/portal/tickets" element={<CustomerProtectedRoute><CustomerTickets /></CustomerProtectedRoute>} />
                <Route path="/portal/payment/callback" element={<CustomerProtectedRoute><PaymentCallback /></CustomerProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </BrandingProvider>
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

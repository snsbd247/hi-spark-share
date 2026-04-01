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
import IntegrationManagement from "@/pages/settings/IntegrationManagement";
import BkashApiManagement from "@/pages/settings/BkashApiManagement";
import NagadApiManagement from "@/pages/settings/NagadApiManagement";

import MikroTikRouters from "@/pages/settings/MikroTikRouters";
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
import FooterSettings from "@/pages/settings/FooterSettings";
import NotFound from "@/pages/NotFound";
import AccPurchases from "@/pages/accounting/Purchases";
import AccProducts from "@/pages/accounting/Products";
import AccVendors from "@/pages/accounting/Vendors";
import AccSales from "@/pages/accounting/Sales";
import AccExpenses from "@/pages/accounting/Expenses";
import AccReports from "@/pages/accounting/Reports";
import ChartOfAccounts from "@/pages/accounting/ChartOfAccounts";
import BalanceSheet from "@/pages/accounting/BalanceSheet";
import JournalEntries from "@/pages/accounting/JournalEntries";
import LedgerStatement from "@/pages/accounting/LedgerStatement";
import ReportLedgerStatement from "@/pages/reporting/LedgerStatement";
import IncomeHead from "@/pages/accounting/IncomeHead";
import ExpenseHead from "@/pages/accounting/ExpenseHead";
import OthersHead from "@/pages/accounting/OthersHead";
import AllTransactions from "@/pages/accounting/AllTransactions";
import AllLedgersList from "@/pages/accounting/AllLedgersList";
import ChequeRegister from "@/pages/accounting/ChequeRegister";
import TrialBalance from "@/pages/accounting/TrialBalance";
import ProfitLoss from "@/pages/accounting/ProfitLoss";
import CashFlowStatement from "@/pages/accounting/CashFlowStatement";
import Daybook from "@/pages/accounting/Daybook";
import EquityChanges from "@/pages/accounting/EquityChanges";
import ReceivablePayable from "@/pages/accounting/ReceivablePayable";
import SalesPurchaseReport from "@/pages/reporting/SalesPurchaseReport";
import DesignationList from "@/pages/hr/DesignationList";
import EmployeeList from "@/pages/hr/EmployeeList";
import DailyAttendance from "@/pages/hr/DailyAttendance";
import MonthlyAttendance from "@/pages/hr/MonthlyAttendance";
import LoanManagement from "@/pages/hr/LoanManagement";
import SalarySheet from "@/pages/hr/SalarySheet";
import EmployeeProfile from "@/pages/hr/EmployeeProfile";
import SupplierList from "@/pages/supplier/SupplierList";
import SupplierPayments from "@/pages/supplier/SupplierPayments";
import SupplierProfile from "@/pages/supplier/SupplierProfile";
import SupplierPurchases from "@/pages/supplier/SupplierPurchases";
import DailyReport from "@/pages/reporting/DailyReport";
import FinancialStatement from "@/pages/reporting/FinancialStatement";
import BtrcReport from "@/pages/reporting/BtrcReport";
import TrafficMonitor from "@/pages/reporting/TrafficMonitor";
import ApiHealthMonitor from "@/pages/settings/ApiHealthMonitor";
import GeoManagement from "@/pages/settings/GeoManagement";
import DomainManagement from "@/pages/settings/DomainManagement";
import { SuperAdminProvider } from "@/contexts/SuperAdminContext";
import SuperAdminLogin from "@/pages/super/SuperAdminLogin";
import SuperAdminLayout from "@/components/super/SuperAdminLayout";
import SuperDashboard from "@/pages/super/SuperDashboard";
import SuperTenants from "@/pages/super/SuperTenants";
import SuperPlans from "@/pages/super/SuperPlans";
import SuperSubscriptions from "@/pages/super/SuperSubscriptions";
import SuperDomains from "@/pages/super/SuperDomains";
import SuperSmsManagement from "@/pages/super/SuperSmsManagement";
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
              <Routes>
                {/* Admin Routes */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
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
                {/* SMS Settings removed - managed via Integration Management */}
                <Route path="/reminders" element={<PermissionGuard module="sms"><ReminderLogs /></PermissionGuard>} />
                <Route path="/profile" element={<ProtectedRoute><AdminProfile /></ProtectedRoute>} />
                <Route path="/users" element={<PermissionGuard module="users"><AdminUsers /></PermissionGuard>} />
                <Route path="/login-logs" element={<PermissionGuard module="settings"><LoginLogs /></PermissionGuard>} />
                <Route path="/audit-logs" element={<PermissionGuard module="settings"><AuditLogs /></PermissionGuard>} />

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

                {/* Supplier Routes */}
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
                <Route path="/settings/bkash" element={<PermissionGuard module="settings"><BkashApiManagement /></PermissionGuard>} />
                <Route path="/settings/nagad" element={<PermissionGuard module="settings"><NagadApiManagement /></PermissionGuard>} />
                <Route path="/settings/backup" element={<PermissionGuard module="settings"><BackupRestore /></PermissionGuard>} />
                <Route path="/settings/api-health" element={<PermissionGuard module="settings"><ApiHealthMonitor /></PermissionGuard>} />
                <Route path="/settings/domains" element={<PermissionGuard module="settings"><DomainManagement /></PermissionGuard>} />

                {/* Public Payment Link */}
                <Route path="/pay" element={<PayBill />} />

                {/* Super Admin Routes */}
                <Route path="/super/login" element={<SuperAdminProvider><SuperAdminLogin /></SuperAdminProvider>} />
                <Route path="/super" element={<SuperAdminProvider><SuperAdminLayout /></SuperAdminProvider>}>
                  <Route path="dashboard" element={<SuperDashboard />} />
                  <Route path="tenants" element={<SuperTenants />} />
                  <Route path="plans" element={<SuperPlans />} />
                  <Route path="subscriptions" element={<SuperSubscriptions />} />
                  <Route path="domains" element={<SuperDomains />} />
                  <Route path="sms" element={<SuperSmsManagement />} />
                </Route>

                {/* Customer Portal Routes */}
                <Route path="/login" element={<CustomerLogin />} />
                <Route path="/portal" element={<CustomerProtectedRoute><CustomerDashboard /></CustomerProtectedRoute>} />
                <Route path="/portal/bills" element={<CustomerProtectedRoute><CustomerBills /></CustomerProtectedRoute>} />
                <Route path="/portal/payments" element={<CustomerProtectedRoute><CustomerPayments /></CustomerProtectedRoute>} />
                <Route path="/portal/profile" element={<CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute>} />
                <Route path="/portal/tickets" element={<CustomerProtectedRoute><CustomerTickets /></CustomerProtectedRoute>} />
                <Route path="/portal/payment-callback" element={<PaymentCallback />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
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

import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { useBranding } from "@/contexts/BrandingContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, Users, Receipt, CreditCard, LogOut, Wifi,
  ChevronLeft, ChevronDown, Ticket, MessageSquare, Settings, Bell, UserCircle,
  Package, MapPin, Router, Shield, Wallet, BarChart3, FileText, Menu, X, ClipboardList, Wrench, KeyRound,
  Sun, Moon, HardDrive, Plug, Building2, ShoppingCart, DollarSign, TrendingUp, BoxIcon,
  Briefcase, CalendarDays, CalendarCheck, Banknote, FileSpreadsheet, Truck, Activity,
  UserPlus, UserCheck, UserX, WifiOff, UserMinus, Globe, BookOpen, Scale, Tag, Network, HelpCircle, PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  module?: string;
}

// ═══════ Menu Groups ═══════

const customerNav: NavItem[] = [
  { to: "/customers", icon: Users, label: "All Customers", module: "customers" },
  { to: "/customers?status=active", icon: UserCheck, label: "Active", module: "customers" },
  { to: "/customers?status=inactive", icon: UserX, label: "Inactive", module: "customers" },
  { to: "/customers?status=suspended", icon: UserX, label: "Suspended", module: "customers" },
  { to: "/customers?connection=online", icon: Globe, label: "Online", module: "customers" },
  { to: "/customers?connection=offline", icon: WifiOff, label: "Offline", module: "customers" },
  { to: "/customers?status=new", icon: UserPlus, label: "New", module: "customers" },
  { to: "/customers?status=free", icon: Users, label: "Free", module: "customers" },
  { to: "/customers?status=left", icon: UserMinus, label: "Left", module: "customers" },
  { to: "/customers?filter=due", icon: Receipt, label: "Due List", module: "customers" },
];

const billingNav: NavItem[] = [
  { to: "/billing", icon: Receipt, label: "Billing", module: "billing" },
  { to: "/billing/cycle", icon: Receipt, label: "Billing Cycle", module: "billing" },
  { to: "/payments", icon: CreditCard, label: "Payments", module: "payments" },
  { to: "/merchant-payments", icon: Wallet, label: "Merchant Payments", module: "merchant_payments" },
  { to: "/merchant-reports", icon: BarChart3, label: "Payment Reports", module: "reports" },
  { to: "/coupons", icon: Tag, label: "Coupons", module: "billing" },
];

const hrNav: NavItem[] = [
  { to: "/hr/employees", icon: Users, label: "Employees", module: "hr" },
  { to: "/hr/designations", icon: Briefcase, label: "Designations", module: "hr" },
  { to: "/hr/daily-attendance", icon: CalendarDays, label: "Daily Attendance", module: "hr" },
  { to: "/hr/monthly-attendance", icon: CalendarCheck, label: "Monthly Attendance", module: "hr" },
  { to: "/hr/salary", icon: FileSpreadsheet, label: "Salary Sheet", module: "hr" },
  { to: "/hr/loans", icon: Banknote, label: "Loans", module: "hr" },
];

const accountingNav: NavItem[] = [
  { to: "/accounting/chart-of-accounts", icon: FileText, label: "Chart of Accounts", module: "accounting" },
  { to: "/accounting/journal-entries", icon: BookOpen, label: "Journal Entries", module: "accounting" },
  { to: "/accounting/transactions", icon: Receipt, label: "Transactions", module: "accounting" },
  { to: "/accounting/all-ledgers", icon: FileText, label: "Ledgers", module: "accounting" },
  { to: "/accounting/daybook", icon: FileText, label: "Daybook", module: "accounting" },
  { to: "/accounting/cheque-register", icon: CreditCard, label: "Cheque Register", module: "accounting" },
  { to: "/accounting/income-head", icon: TrendingUp, label: "Income Heads", module: "accounting" },
  { to: "/accounting/expense-head", icon: DollarSign, label: "Expense Heads", module: "accounting" },
  { to: "/accounting/others-head", icon: BoxIcon, label: "Other Heads", module: "accounting" },
  { to: "/accounting/expenses", icon: DollarSign, label: "Expenses", module: "accounting" },
  
  { to: "/accounting/receivable-payable", icon: Receipt, label: "Receivable & Payable", module: "accounting" },
  { to: "/accounting/trial-balance", icon: Scale, label: "Trial Balance", module: "accounting" },
  { to: "/accounting/profit-loss", icon: TrendingUp, label: "Profit & Loss", module: "accounting" },
  { to: "/accounting/balance-sheet", icon: Scale, label: "Balance Sheet", module: "accounting" },
  { to: "/accounting/cash-flow", icon: Wallet, label: "Cash Flow", module: "accounting" },
  { to: "/accounting/equity-changes", icon: BarChart3, label: "Equity Changes", module: "accounting" },
];

const inventoryNav: NavItem[] = [
  { to: "/inventory", icon: BarChart3, label: "Dashboard", module: "inventory" },
  { to: "/inventory/products", icon: BoxIcon, label: "Products", module: "inventory" },
  { to: "/inventory/categories", icon: BoxIcon, label: "Categories", module: "inventory" },
  { to: "/inventory/serials", icon: BoxIcon, label: "Serial Numbers", module: "inventory" },
  { to: "/inventory/devices", icon: BoxIcon, label: "Customer Devices", module: "inventory" },
  { to: "/inventory/sales", icon: DollarSign, label: "Sales", module: "inventory" },
  { to: "/inventory/logs", icon: BoxIcon, label: "Stock Logs", module: "inventory" },
];

const supplierNav: NavItem[] = [
  { to: "/supplier/list", icon: Truck, label: "Suppliers", module: "supplier" },
  { to: "/supplier/purchases", icon: ShoppingCart, label: "Purchases", module: "supplier" },
  { to: "/supplier/payments", icon: Wallet, label: "Payments", module: "supplier" },
];

const supportNav: NavItem[] = [
  { to: "/tickets", icon: Ticket, label: "Tickets", module: "tickets" },
  { to: "/faq", icon: HelpCircle, label: "FAQ", module: "settings" },
  { to: "/sms", icon: MessageSquare, label: "SMS Logs", module: "sms" },
  { to: "/reminders", icon: Bell, label: "Reminders", module: "sms" },
];

const reportingNav: NavItem[] = [
  { to: "/analytics", icon: PieChart, label: "Advanced Analytics", module: "reports" },
  { to: "/reporting/daily", icon: FileText, label: "Daily Report", module: "reports" },
  { to: "/reporting/financial", icon: BarChart3, label: "Financial Statement", module: "reports" },
  { to: "/reporting/ledger-statement", icon: BookOpen, label: "Ledger Statement", module: "reports" },
  { to: "/reporting/sales-purchase", icon: ShoppingCart, label: "Sales & Purchase", module: "reports" },
  { to: "/reporting/btrc", icon: ClipboardList, label: "BTRC Report", module: "reports" },
  { to: "/reporting/traffic", icon: Activity, label: "Traffic Monitor", module: "reports" },
];

const adminNav: NavItem[] = [
  { to: "/profile", icon: UserCircle, label: "My Profile" },
  { to: "/users", icon: Shield, label: "Admin Users", module: "users" },
  { to: "/settings/roles", icon: KeyRound, label: "Roles & Permissions", module: "roles" },
];

const settingsNav: NavItem[] = [
  { to: "/settings/system", icon: Settings, label: "System Settings", module: "settings" },
  { to: "/settings/packages", icon: Package, label: "Packages", module: "settings" },
  { to: "/ip-pools", icon: Network, label: "IP Pools", module: "settings" },
  { to: "/settings/mikrotik", icon: Router, label: "MikroTik Routers", module: "settings" },
  { to: "/login-logs", icon: FileText, label: "Login Logs", module: "settings" },
  { to: "/audit-logs", icon: ClipboardList, label: "Audit Logs", module: "settings" },
  { to: "/settings/backup", icon: HardDrive, label: "Backup & Restore", module: "settings" },
  { to: "/settings/api-health", icon: Activity, label: "API Health", module: "settings" },
  { to: "/settings/domains", icon: Globe, label: "Domain Management", module: "settings" },
];

// ═══════ NavGroup component ═══════

interface NavGroupProps {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  collapsed: boolean;
  location: ReturnType<typeof useLocation>;
  defaultOpen?: boolean;
  onNavigate?: () => void;
}

function NavGroup({ label, icon: Icon, items, collapsed, location, defaultOpen = false, onNavigate }: NavGroupProps) {
  const isMatch = (item: NavItem) => item.to.includes("?") ? location.pathname + location.search === item.to : location.pathname === item.to;
  const isChildActive = items.some(isMatch);
  const [open, setOpen] = useState(defaultOpen || isChildActive);

  if (collapsed) {
    return (
      <>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={onNavigate}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isMatch(item) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}>
            <item.icon className="h-5 w-5 shrink-0" />
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <div className="pt-1">
      <button onClick={() => setOpen(!open)}
        className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full transition-colors",
          isChildActive ? "text-sidebar-foreground bg-sidebar-accent/50" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}>
        <Icon className="h-4.5 w-4.5 shrink-0" />
        <span className="flex-1 text-left text-[13px]">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-0.5">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onNavigate}
              className={cn("flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors",
                isMatch(item) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}>
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════ Main Sidebar ═══════

export default function AppSidebar() {
  const { signOut } = useAuth();
  const location = useLocation();
  const { hasModuleAccess, isSuperAdmin, customRoleName } = usePermissions();
  const { isModuleEnabled } = useModuleSettings();
  const isOwner = isSuperAdmin || customRoleName?.toLowerCase() === "owner";
  const { branding } = useBranding();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  // Dynamic labels from translations
  const tCustomerNav: NavItem[] = [
    { to: "/customers", icon: Users, label: t.sidebar.allCustomers, module: "customers" },
    { to: "/customers?status=active", icon: UserCheck, label: t.sidebar.activeCustomers, module: "customers" },
    { to: "/customers?status=inactive", icon: UserX, label: t.sidebar.inactiveCustomers, module: "customers" },
    { to: "/customers?status=suspended", icon: UserX, label: t.sidebar.suspendedCustomers, module: "customers" },
    { to: "/customers?connection=online", icon: Globe, label: t.sidebar.onlineCustomers, module: "customers" },
    { to: "/customers?connection=offline", icon: WifiOff, label: t.sidebar.offlineCustomers, module: "customers" },
    { to: "/customers?status=new", icon: UserPlus, label: t.sidebar.newCustomers, module: "customers" },
    { to: "/customers?status=free", icon: Users, label: t.sidebar.freeCustomers, module: "customers" },
    { to: "/customers?status=left", icon: UserMinus, label: t.sidebar.leftCustomers, module: "customers" },
    { to: "/customers?filter=due", icon: Receipt, label: t.sidebar.dueList, module: "customers" },
  ];

  const tBillingNav: NavItem[] = [
    { to: "/billing", icon: Receipt, label: t.sidebar.billing, module: "billing" },
    { to: "/billing/cycle", icon: Receipt, label: t.sidebar.billingCycle, module: "billing" },
    { to: "/payments", icon: CreditCard, label: t.sidebar.payments, module: "payments" },
    { to: "/merchant-payments", icon: Wallet, label: t.sidebar.merchantPayments, module: "merchant_payments" },
    { to: "/merchant-reports", icon: BarChart3, label: t.sidebar.paymentReports, module: "reports" },
    { to: "/coupons", icon: Tag, label: "Coupons", module: "billing" },
  ];

  const tHrNav: NavItem[] = [
    { to: "/hr/employees", icon: Users, label: t.sidebar.employees, module: "hr" },
    { to: "/hr/designations", icon: Briefcase, label: t.sidebar.designations, module: "hr" },
    { to: "/hr/daily-attendance", icon: CalendarDays, label: t.sidebar.dailyAttendance, module: "hr" },
    { to: "/hr/monthly-attendance", icon: CalendarCheck, label: t.sidebar.monthlyAttendance, module: "hr" },
    { to: "/hr/salary", icon: FileSpreadsheet, label: t.sidebar.salarySheet, module: "hr" },
    { to: "/hr/loans", icon: Banknote, label: t.sidebar.loans, module: "hr" },
  ];

  const tAccountingNav: NavItem[] = [
    { to: "/accounting/chart-of-accounts", icon: FileText, label: t.sidebar.chartOfAccounts, module: "accounting" },
    { to: "/accounting/journal-entries", icon: BookOpen, label: t.sidebar.journalEntries, module: "accounting" },
    { to: "/accounting/transactions", icon: Receipt, label: t.sidebar.transactions, module: "accounting" },
    { to: "/accounting/all-ledgers", icon: FileText, label: t.sidebar.ledgers, module: "accounting" },
    { to: "/accounting/daybook", icon: FileText, label: t.sidebar.daybook, module: "accounting" },
    { to: "/accounting/cheque-register", icon: CreditCard, label: t.sidebar.chequeRegister, module: "accounting" },
    { to: "/accounting/income-head", icon: TrendingUp, label: t.sidebar.incomeHeads, module: "accounting" },
    { to: "/accounting/expense-head", icon: DollarSign, label: t.sidebar.expenseHeads, module: "accounting" },
    { to: "/accounting/others-head", icon: BoxIcon, label: t.sidebar.otherHeads, module: "accounting" },
    { to: "/accounting/expenses", icon: DollarSign, label: t.sidebar.expenses, module: "accounting" },
    
    { to: "/accounting/receivable-payable", icon: Receipt, label: t.sidebar.receivablePayable, module: "accounting" },
    { to: "/accounting/trial-balance", icon: Scale, label: t.sidebar.trialBalance, module: "accounting" },
    { to: "/accounting/profit-loss", icon: TrendingUp, label: t.sidebar.profitLoss, module: "accounting" },
    { to: "/accounting/balance-sheet", icon: Scale, label: t.sidebar.balanceSheet, module: "accounting" },
    { to: "/accounting/cash-flow", icon: Wallet, label: t.sidebar.cashFlow, module: "accounting" },
    { to: "/accounting/equity-changes", icon: BarChart3, label: t.sidebar.equityChanges, module: "accounting" },
  ];

  const tInventoryNav: NavItem[] = [
    { to: "/inventory", icon: BarChart3, label: t.sidebar.inventory || "Dashboard", module: "inventory" },
    { to: "/inventory/products", icon: BoxIcon, label: t.sidebar.products, module: "inventory" },
    { to: "/inventory/categories", icon: BoxIcon, label: "Categories", module: "inventory" },
    { to: "/inventory/serials", icon: BoxIcon, label: "Serial Numbers", module: "inventory" },
    { to: "/inventory/devices", icon: BoxIcon, label: "Customer Devices", module: "inventory" },
    { to: "/inventory/sales", icon: DollarSign, label: t.sidebar.sales, module: "inventory" },
    { to: "/inventory/logs", icon: BoxIcon, label: "Stock Logs", module: "inventory" },
  ];

  const tSupplierNav: NavItem[] = [
    { to: "/supplier/list", icon: Truck, label: t.sidebar.suppliers, module: "supplier" },
    { to: "/supplier/purchases", icon: ShoppingCart, label: t.sidebar.purchases, module: "supplier" },
    { to: "/supplier/payments", icon: Wallet, label: t.sidebar.payments, module: "supplier" },
  ];

  const tSupportNav: NavItem[] = [
    { to: "/tickets", icon: Ticket, label: t.sidebar.tickets, module: "tickets" },
    { to: "/faq", icon: HelpCircle, label: "FAQ", module: "settings" },
    { to: "/sms", icon: MessageSquare, label: t.sidebar.smsLogs, module: "sms" },
    { to: "/reminders", icon: Bell, label: t.sidebar.reminders, module: "sms" },
  ];

  const tReportingNav: NavItem[] = [
    { to: "/analytics", icon: PieChart, label: "Advanced Analytics", module: "reports" },
    { to: "/reporting/daily", icon: FileText, label: t.sidebar.dailyReport, module: "reports" },
    { to: "/reporting/financial", icon: BarChart3, label: t.sidebar.financialStatement, module: "reports" },
    { to: "/reporting/ledger-statement", icon: BookOpen, label: t.sidebar.ledgerStatement, module: "reports" },
    { to: "/reporting/sales-purchase", icon: ShoppingCart, label: t.sidebar.salesPurchase, module: "reports" },
    { to: "/reporting/btrc", icon: ClipboardList, label: t.sidebar.btrcReport, module: "reports" },
    { to: "/reporting/traffic", icon: Activity, label: t.sidebar.trafficMonitor, module: "reports" },
  ];

  const tAdminNav: NavItem[] = [
    { to: "/profile", icon: UserCircle, label: t.sidebar.myProfile },
    { to: "/users", icon: Shield, label: t.sidebar.adminUsers, module: "users" },
    { to: "/settings/roles", icon: KeyRound, label: t.sidebar.rolesPermissions, module: "roles" },
  ];

  const tSettingsNav: NavItem[] = [
    { to: "/settings/system", icon: Settings, label: t.sidebar.systemSettings, module: "settings" },
    { to: "/settings/packages", icon: Package, label: t.sidebar.packages, module: "settings" },
    { to: "/ip-pools", icon: Network, label: "IP Pools", module: "settings" },
    { to: "/settings/integrations", icon: Plug, label: "Integrations", module: "settings" },
    { to: "/settings/locations", icon: Globe, label: "Location Management", module: "settings" },
    { to: "/settings/mikrotik", icon: Router, label: t.sidebar.mikrotikRouters, module: "settings" },
    { to: "/login-logs", icon: FileText, label: t.sidebar.loginLogs, module: "settings" },
    { to: "/audit-logs", icon: ClipboardList, label: t.sidebar.auditLogs, module: "settings" },
    { to: "/settings/backup", icon: HardDrive, label: t.sidebar.backupRestore, module: "settings" },
    { to: "/settings/api-health", icon: Activity, label: t.sidebar.apiHealth, module: "settings" },
    { to: "/settings/domains", icon: Globe, label: "Domain Management", module: "settings" },
    { to: "/settings/subscription", icon: Receipt, label: "Subscription Invoices" },
  ];

  const siteName = branding.site_name || "Smart ISP";

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (isOwner) return true;
      if (item.module && !isModuleEnabled(item.module)) return false;
      if (item.module && !isSuperAdmin && !hasModuleAccess(item.module)) return false;
      return true;
    });

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={siteName} className="h-8 w-8 rounded-lg object-contain shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Wifi className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
        )}
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden flex-1 min-w-0">
            <h2 className="font-bold text-sm leading-tight truncate">{siteName}</h2>
            <p className="text-[10px] text-sidebar-foreground/50">{t.sidebar.adminPanel}</p>
          </div>
        )}
        {isMobile ? (
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0" onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto sidebar-scroll">
        {/* Dashboard */}
        <NavLink to="/" onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname === "/" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          )}>
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {(!collapsed || isMobile) && <span>{t.sidebar.dashboard}</span>}
        </NavLink>

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t.sidebar.ispManagement}</p>}

        {filterItems(tCustomerNav).length > 0 && <NavGroup label={t.sidebar.customers} icon={Users} items={filterItems(tCustomerNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tBillingNav).length > 0 && <NavGroup label={t.sidebar.billingPayments} icon={Receipt} items={filterItems(tBillingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tSupportNav).length > 0 && <NavGroup label={t.sidebar.supportSms} icon={Ticket} items={filterItems(tSupportNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t.sidebar.business}</p>}

        {filterItems(tAccountingNav).length > 0 && <NavGroup label={t.sidebar.accounting} icon={CreditCard} items={filterItems(tAccountingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tInventoryNav).length > 0 && <NavGroup label={t.sidebar.inventory} icon={BoxIcon} items={filterItems(tInventoryNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tSupplierNav).length > 0 && <NavGroup label={t.sidebar.supplier} icon={Truck} items={filterItems(tSupplierNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tHrNav).length > 0 && <NavGroup label={t.sidebar.humanResource} icon={Briefcase} items={filterItems(tHrNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t.sidebar.analyticsReports}</p>}

        {filterItems(tReportingNav).length > 0 && <NavGroup label={t.sidebar.reports} icon={BarChart3} items={filterItems(tReportingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t.sidebar.administration}</p>}

        {filterItems(tAdminNav).length > 0 && <NavGroup label={t.sidebar.usersRoles} icon={Shield} items={filterItems(tAdminNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tSettingsNav).length > 0 && <NavGroup label={t.sidebar.settings} icon={Settings} items={filterItems(tSettingsNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5 shrink-0">
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {(!collapsed || isMobile) && <span className="text-[13px]">{theme === "dark" ? t.sidebar.lightMode : t.sidebar.darkMode}</span>}
        </button>
        <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span className="text-[13px]">{t.auth.signOut}</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={siteName} className="h-7 w-7 rounded-lg object-contain" />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Wifi className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
          </div>
        )}
        <h2 className="font-bold text-sm text-sidebar-foreground truncate">{siteName}</h2>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl animate-in slide-in-from-left duration-300">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "h-screen bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border transition-all duration-300 sticky top-0 hidden md:flex",
        collapsed ? "w-[68px]" : "w-64"
      )}>
        {sidebarContent(false)}
      </aside>
    </>
  );
}

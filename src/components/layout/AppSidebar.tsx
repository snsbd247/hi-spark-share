import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { useBranding } from "@/contexts/BrandingContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, Users, Receipt, CreditCard, LogOut, Wifi,
  ChevronLeft, ChevronDown, Ticket, MessageSquare, Settings, Bell, UserCircle,
  Package, Router, Shield, Wallet, BarChart3, FileText, Menu, X, ClipboardList, Wrench, KeyRound,
  Sun, Moon, Plug, Building2, ShoppingCart, DollarSign, TrendingUp, BoxIcon,
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
            className={cn("flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
              isMatch(item) ? "bg-sidebar-primary/20 text-sidebar-primary" : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
            )}>
            {isMatch(item) && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
            <item.icon className="h-[18px] w-[18px] shrink-0" />
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <div className="pt-0.5">
      <button onClick={() => setOpen(!open)}
        className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium w-full transition-all duration-200",
          isChildActive ? "text-sidebar-foreground bg-sidebar-accent/50" : "text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}>
        <Icon className={cn("h-[18px] w-[18px] shrink-0", isChildActive ? "text-sidebar-primary" : "text-sidebar-foreground/35")} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 pl-3 border-l border-sidebar-border/40 space-y-0.5 mt-0.5">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onNavigate}
              className={cn("flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all duration-200 relative group",
                isMatch(item)
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
              <item.icon className={cn("h-3.5 w-3.5 shrink-0", isMatch(item) ? "text-sidebar-primary" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60")} />
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
    { to: "/coupons", icon: Tag, label: t.sidebar.coupons, module: "billing" },
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
    { to: "/accounting", icon: BarChart3, label: t.sidebar.accountingDashboard || "Dashboard", module: "accounting" },
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
    { to: "/inventory/categories", icon: BoxIcon, label: t.sidebar.categories, module: "inventory" },
    { to: "/inventory/serials", icon: BoxIcon, label: t.sidebar.serialNumbers, module: "inventory" },
    { to: "/inventory/devices", icon: BoxIcon, label: t.sidebar.customerDevices, module: "inventory" },
    { to: "/inventory/sales", icon: DollarSign, label: t.sidebar.sales, module: "inventory" },
    { to: "/inventory/logs", icon: BoxIcon, label: t.sidebar.stockLogs, module: "inventory" },
  ];

  const tSupplierNav: NavItem[] = [
    { to: "/supplier/list", icon: Truck, label: t.sidebar.suppliers, module: "supplier" },
    { to: "/supplier/purchases", icon: ShoppingCart, label: t.sidebar.purchases, module: "supplier" },
    { to: "/supplier/payments", icon: Wallet, label: t.sidebar.payments, module: "supplier" },
  ];

  const tSupportNav: NavItem[] = [
    { to: "/tickets", icon: Ticket, label: t.sidebar.tickets, module: "tickets" },
    { to: "/faq", icon: HelpCircle, label: t.sidebar.faq, module: "settings" },
    { to: "/sms", icon: MessageSquare, label: t.sidebar.smsLogs, module: "sms" },
    { to: "/reminders", icon: Bell, label: t.sidebar.reminders, module: "sms" },
  ];

  const tReportingNav: NavItem[] = [
    { to: "/analytics", icon: PieChart, label: t.sidebar.advancedAnalytics, module: "reports" },
    { to: "/reporting/revenue", icon: TrendingUp, label: t.sidebar.revenueReport, module: "reports" },
    { to: "/reporting/expense", icon: DollarSign, label: t.sidebar.expenseReport, module: "reports" },
    { to: "/reporting/profit-loss", icon: BarChart3, label: t.sidebar.profitLossReport, module: "reports" },
    { to: "/reporting/cash-flow", icon: Wallet, label: t.sidebar.cashFlowReport, module: "reports" },
    { to: "/reporting/trial-balance", icon: Scale, label: t.sidebar.trialBalanceReport, module: "reports" },
    { to: "/reporting/balance-sheet", icon: BookOpen, label: t.sidebar.balanceSheetReport, module: "reports" },
    { to: "/reporting/receivable-payable", icon: Users, label: t.sidebar.receivablePayableReport, module: "reports" },
    { to: "/reporting/inventory", icon: Package, label: t.sidebar.inventoryReport, module: "reports" },
    { to: "/reporting/daily", icon: FileText, label: t.sidebar.dailyReport, module: "reports" },
    { to: "/reporting/financial", icon: FileSpreadsheet, label: t.sidebar.financialStatement, module: "reports" },
    { to: "/reporting/ledger-statement", icon: ClipboardList, label: t.sidebar.ledgerStatement, module: "reports" },
    { to: "/reporting/sales-purchase", icon: ShoppingCart, label: t.sidebar.salesPurchase, module: "reports" },
    { to: "/reporting/btrc", icon: Globe, label: t.sidebar.btrcReport, module: "reports" },
    { to: "/reporting/traffic", icon: Activity, label: t.sidebar.trafficMonitor, module: "reports" },
    { to: "/bandwidth-analytics", icon: Activity, label: "Bandwidth Analytics", module: "reports" },
    { to: "/live-bandwidth", icon: Wifi, label: "Live Bandwidth", module: "reports" },
  ];

  const tAdminNav: NavItem[] = [
    { to: "/profile", icon: UserCircle, label: t.sidebar.myProfile },
    { to: "/users", icon: Shield, label: t.sidebar.adminUsers, module: "users" },
    { to: "/settings/roles", icon: KeyRound, label: t.sidebar.rolesPermissions, module: "roles" },
  ];

  const tSettingsNav: NavItem[] = [
    { to: "/settings/system", icon: Settings, label: t.sidebar.systemSettings, module: "settings" },
    { to: "/settings/packages", icon: Package, label: t.sidebar.packages, module: "settings" },
    { to: "/ip-pools", icon: Network, label: t.sidebar.ipPools, module: "settings" },
    { to: "/settings/integrations", icon: Plug, label: t.sidebar.integrations, module: "settings" },
    { to: "/settings/locations", icon: Globe, label: t.sidebar.locationManagement, module: "settings" },
    { to: "/settings/mikrotik", icon: Router, label: t.sidebar.mikrotikRouters, module: "settings" },
    { to: "/login-logs", icon: FileText, label: t.sidebar.loginLogs, module: "settings" },
    { to: "/audit-logs", icon: ClipboardList, label: t.sidebar.auditLogs, module: "settings" },
    { to: "/settings/api-health", icon: Activity, label: t.sidebar.apiHealth, module: "settings" },
    { to: "/settings/domains", icon: Globe, label: t.sidebar.domainManagement, module: "settings" },
    { to: "/settings/subscription", icon: Receipt, label: t.sidebar.subscriptionInvoices },
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
      {/* Logo with gradient accent */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border/60 shrink-0">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={siteName} className="h-9 w-9 rounded-xl object-contain shrink-0 ring-1 ring-sidebar-border/30" />
        ) : (
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sidebar-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <Wifi className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
        )}
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden flex-1 min-w-0">
            <h2 className="font-bold text-sm leading-tight truncate text-sidebar-foreground">{siteName}</h2>
            <p className="text-[10px] text-sidebar-foreground/40 font-medium">{t.sidebar.adminPanel}</p>
          </div>
        )}
        {isMobile ? (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0" onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto sidebar-scroll">
        {/* Dashboard */}
        <NavLink to="/" onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative group",
            location.pathname === "/"
              ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-primary/10 text-sidebar-primary"
              : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
          )}>
          {location.pathname === "/" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
          <LayoutDashboard className={cn("h-[18px] w-[18px] shrink-0", location.pathname === "/" ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
          {(!collapsed || isMobile) && <span>{t.sidebar.dashboard}</span>}
        </NavLink>

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25">{t.sidebar.ispManagement}</p>}

        {filterItems(tCustomerNav).length > 0 && <NavGroup label={t.sidebar.customers} icon={Users} items={filterItems(tCustomerNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tBillingNav).length > 0 && <NavGroup label={t.sidebar.billingPayments} icon={Receipt} items={filterItems(tBillingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tSupportNav).length > 0 && <NavGroup label={t.sidebar.supportSms} icon={Ticket} items={filterItems(tSupportNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}

        {/* Reseller Management - standalone item */}
        <NavLink to="/resellers" onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative group",
            location.pathname === "/resellers"
              ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-primary/10 text-sidebar-primary"
              : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
          )}>
          {location.pathname === "/resellers" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
          <Users className={cn("h-[18px] w-[18px] shrink-0", location.pathname === "/resellers" ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
          {(!collapsed || isMobile) && <span>Resellers</span>}
        </NavLink>

        <NavLink to="/reseller-profit-report" onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative group",
            location.pathname === "/reseller-profit-report"
              ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-primary/10 text-sidebar-primary"
              : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
          )}>
          {location.pathname === "/reseller-profit-report" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
          <TrendingUp className={cn("h-[18px] w-[18px] shrink-0", location.pathname === "/reseller-profit-report" ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
          {(!collapsed || isMobile) && <span>Reseller Profit</span>}
        </NavLink>

        <NavLink to="/fiber-topology" onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative group",
            location.pathname === "/fiber-topology"
              ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-primary/10 text-sidebar-primary"
              : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
          )}>
          {location.pathname === "/fiber-topology" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
          <Network className={cn("h-[18px] w-[18px] shrink-0", location.pathname === "/fiber-topology" ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
          {(!collapsed || isMobile) && <span>{t.sidebar.fiberTopology}</span>}
        </NavLink>

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25">{t.sidebar.business}</p>}

        {filterItems(tAccountingNav).length > 0 && <NavGroup label={t.sidebar.accounting} icon={CreditCard} items={filterItems(tAccountingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tInventoryNav).length > 0 && <NavGroup label={t.sidebar.inventory} icon={BoxIcon} items={filterItems(tInventoryNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tSupplierNav).length > 0 && <NavGroup label={t.sidebar.supplier} icon={Truck} items={filterItems(tSupplierNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tHrNav).length > 0 && <NavGroup label={t.sidebar.humanResource} icon={Briefcase} items={filterItems(tHrNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25">{t.sidebar.analyticsReports}</p>}

        {filterItems(tReportingNav).length > 0 && <NavGroup label={t.sidebar.reports} icon={BarChart3} items={filterItems(tReportingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}

        {(!collapsed || isMobile) && <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25">{t.sidebar.administration}</p>}

        {filterItems(tAdminNav).length > 0 && <NavGroup label={t.sidebar.usersRoles} icon={Shield} items={filterItems(tAdminNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(tSettingsNav).length > 0 && <NavGroup label={t.sidebar.settings} icon={Settings} items={filterItems(tSettingsNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t border-sidebar-border/60 space-y-0.5 shrink-0">
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-all duration-200">
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {(!collapsed || isMobile) && <span>{theme === "dark" ? t.sidebar.lightMode : t.sidebar.darkMode}</span>}
        </button>
        <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-all duration-200">
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>{t.auth.signOut}</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border/60 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={siteName} className="h-7 w-7 rounded-lg object-contain" />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
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
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 glass-sidebar text-sidebar-foreground flex flex-col shadow-2xl shadow-primary/10 animate-in slide-in-from-left duration-300">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "h-screen glass-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border/40 transition-all duration-300 sticky top-0 hidden md:flex",
        collapsed ? "w-[68px]" : "w-64"
      )}>
        {sidebarContent(false)}
      </aside>
    </>
  );
}

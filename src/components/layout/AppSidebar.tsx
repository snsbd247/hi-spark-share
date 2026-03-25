import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import {
  LayoutDashboard, Users, Receipt, CreditCard, LogOut, Wifi,
  ChevronLeft, ChevronDown, Ticket, MessageSquare, Settings, Bell, UserCircle,
  Package, MapPin, Router, Shield, Wallet, BarChart3, FileText, Menu, X, ClipboardList, Wrench, KeyRound,
  Sun, Moon, HardDrive, Plug, Building2, ShoppingCart, DollarSign, TrendingUp, BoxIcon,
  Briefcase, CalendarDays, CalendarCheck, Banknote, FileSpreadsheet, Truck, Activity,
  UserPlus, UserCheck, UserX, WifiOff, UserMinus, Globe, BookOpen, Scale,
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

const topNav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
];

const customerNav: NavItem[] = [
  { to: "/customers", icon: Users, label: "All Customer", module: "customers" },
  { to: "/customers?status=new", icon: UserPlus, label: "New Customer", module: "customers" },
  { to: "/customers?status=active", icon: UserCheck, label: "Active Customer", module: "customers" },
  { to: "/customers?status=inactive", icon: UserX, label: "Inactive Customer", module: "customers" },
  { to: "/customers?connection=online", icon: Globe, label: "Online Customer", module: "customers" },
  { to: "/customers?connection=offline", icon: WifiOff, label: "Offline Customer", module: "customers" },
  { to: "/customers?status=free", icon: Users, label: "Free Customer", module: "customers" },
  { to: "/customers?status=left", icon: UserMinus, label: "Left Customer", module: "customers" },
  { to: "/customers?filter=due", icon: Receipt, label: "Customer Due", module: "customers" },
  { to: "/payments", icon: CreditCard, label: "Customer Payments", module: "payments" },
];

const hrNav: NavItem[] = [
  { to: "/hr/designations", icon: Briefcase, label: "Designation List", module: "hr" },
  { to: "/hr/employees", icon: Users, label: "Employee List", module: "hr" },
  { to: "/hr/daily-attendance", icon: CalendarDays, label: "Daily Attendance", module: "hr" },
  { to: "/hr/monthly-attendance", icon: CalendarCheck, label: "Monthly Attendance", module: "hr" },
  { to: "/hr/loans", icon: Banknote, label: "Loan Management", module: "hr" },
  { to: "/hr/salary", icon: FileSpreadsheet, label: "Salary Sheet", module: "hr" },
];

const accountsNav: NavItem[] = [
  { to: "/accounting/chart-of-accounts", icon: FileText, label: "Chart of Accounts", module: "accounting" },
  { to: "/accounting/journal-entries", icon: BookOpen, label: "Journal Entries", module: "accounting" },
  { to: "/accounting/balance-sheet", icon: Scale, label: "Balance Sheet", module: "accounting" },
  { to: "/accounting/income-head", icon: TrendingUp, label: "Income Head", module: "accounting" },
  { to: "/accounting/expense-head", icon: DollarSign, label: "Expense Head", module: "accounting" },
  { to: "/accounting/others-head", icon: BoxIcon, label: "Others Head", module: "accounting" },
  { to: "/accounting/transactions", icon: Receipt, label: "All Transactions", module: "accounting" },
];

const supplierNav: NavItem[] = [
  { to: "/supplier/list", icon: Truck, label: "Supplier List", module: "supplier" },
  { to: "/supplier/payments", icon: Wallet, label: "Supplier Payments", module: "supplier" },
];

const billingNav: NavItem[] = [
  { to: "/billing", icon: Receipt, label: "Billing", module: "billing" },
  { to: "/billing/cycle", icon: Receipt, label: "Billing Cycle", module: "billing" },
  { to: "/merchant-payments", icon: Wallet, label: "Merchant Pay", module: "merchant_payments" },
  { to: "/merchant-reports", icon: BarChart3, label: "Payment Reports", module: "reports" },
];

const supportNav: NavItem[] = [
  { to: "/tickets", icon: Ticket, label: "Tickets", module: "tickets" },
  { to: "/sms", icon: MessageSquare, label: "SMS", module: "sms" },
  { to: "/reminders", icon: Bell, label: "Reminders", module: "sms" },
  { to: "/sms-settings", icon: Settings, label: "SMS Settings", module: "sms" },
];

const inventoryNav: NavItem[] = [
  { to: "/accounting/products", icon: BoxIcon, label: "Products", module: "accounting" },
  { to: "/accounting/vendors", icon: Building2, label: "Vendors", module: "accounting" },
  { to: "/accounting/purchases", icon: ShoppingCart, label: "Purchases", module: "accounting" },
  { to: "/accounting/sales", icon: DollarSign, label: "Sales", module: "accounting" },
  { to: "/accounting/expenses", icon: DollarSign, label: "Expenses", module: "accounting" },
];

const reportingNav: NavItem[] = [
  { to: "/reporting/daily", icon: FileText, label: "Daily Report", module: "reports" },
  { to: "/reporting/financial", icon: BarChart3, label: "Financial Statement", module: "reports" },
  { to: "/reporting/btrc", icon: ClipboardList, label: "BTRC Report", module: "reports" },
  { to: "/reporting/traffic", icon: Activity, label: "Traffic Monitor", module: "reports" },
];

const toolsNav: NavItem[] = [
  { to: "/profile", icon: UserCircle, label: "Profile" },
  { to: "/users", icon: Shield, label: "Users", module: "users" },
  { to: "/settings/packages", icon: Package, label: "Packages", module: "settings" },
  { to: "/settings/zones", icon: MapPin, label: "Zones", module: "settings" },
];

const settingsNav: NavItem[] = [
  { to: "/settings/system", icon: Settings, label: "System Settings", module: "settings" },
  { to: "/settings/integrations", icon: Plug, label: "Integrations", module: "settings" },
  { to: "/settings/roles", icon: KeyRound, label: "Roles", module: "roles" },
  { to: "/settings/mikrotik", icon: Router, label: "MikroTik Routers", module: "settings" },
  { to: "/login-logs", icon: FileText, label: "Login Logs", module: "settings" },
  { to: "/audit-logs", icon: ClipboardList, label: "Audit Logs", module: "settings" },
  { to: "/settings/backup", icon: HardDrive, label: "Backup & Restore", module: "settings" },
  { to: "/safe-mode", icon: Shield, label: "Safe Mode", module: "settings" },
];

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
  const isChildActive = items.some((item) => {
    if (item.to.includes("?")) {
      return location.pathname + location.search === item.to;
    }
    return location.pathname === item.to;
  });
  const [open, setOpen] = useState(defaultOpen || isChildActive);

  if (collapsed) {
    return (
      <>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              (item.to.includes("?") ? location.pathname + location.search === item.to : location.pathname === item.to)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 mt-0.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                (item.to.includes("?") ? location.pathname + location.search === item.to : location.pathname === item.to)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppSidebar() {
  const { signOut } = useAuth();
  const location = useLocation();
  const { hasModuleAccess, isSuperAdmin } = usePermissions();
  const { isModuleEnabled } = useModuleSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.module && !isSuperAdmin && !hasModuleAccess(item.module)) return false;
      if (item.module && !isSuperAdmin && !isModuleEnabled(item.module)) return false;
      return true;
    });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Wifi className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <h2 className="font-bold text-sm leading-tight">Smart ISP</h2>
            <p className="text-[11px] text-sidebar-foreground/60">Admin Panel</p>
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

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filterItems(topNav).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={isMobile ? () => setMobileOpen(false) : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.to
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {(!collapsed || isMobile) && <span>{item.label}</span>}
          </NavLink>
        ))}

        {filterItems(customerNav).length > 0 && <NavGroup label="Customer" icon={Users} items={filterItems(customerNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(billingNav).length > 0 && <NavGroup label="Billing" icon={Receipt} items={filterItems(billingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(hrNav).length > 0 && <NavGroup label="Human Resource" icon={Briefcase} items={filterItems(hrNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(accountsNav).length > 0 && <NavGroup label="Accounts" icon={CreditCard} items={filterItems(accountsNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(supplierNav).length > 0 && <NavGroup label="Supplier" icon={Truck} items={filterItems(supplierNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(inventoryNav).length > 0 && <NavGroup label="Inventory" icon={BoxIcon} items={filterItems(inventoryNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(supportNav).length > 0 && <NavGroup label="Support" icon={Ticket} items={filterItems(supportNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(reportingNav).length > 0 && <NavGroup label="Reporting" icon={BarChart3} items={filterItems(reportingNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(toolsNav).length > 0 && <NavGroup label="Tools" icon={Wrench} items={filterItems(toolsNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
        {filterItems(settingsNav).length > 0 && <NavGroup label="Settings" icon={Settings} items={filterItems(settingsNav)} collapsed={!isMobile && collapsed} location={location} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
          {(!collapsed || isMobile) && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <LogOut className="h-5 w-5 shrink-0" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
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
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Wifi className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <h2 className="font-bold text-sm text-sidebar-foreground">Smart ISP</h2>
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
      <aside
        className={cn(
          "h-screen bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border transition-all duration-300 sticky top-0 hidden md:flex",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Building2, CreditCard, LogOut, 
  ChevronLeft, Settings, Shield, BarChart3, Menu, X, ClipboardList,
  Sun, Moon, Package, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  { to: "/super-admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/super-admin/tenants", icon: Building2, label: "Tenants" },
  { to: "/super-admin/plans", icon: Package, label: "Plans" },
  { to: "/super-admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
  { to: "/super-admin/payments", icon: BarChart3, label: "Payments" },
  { to: "/super-admin/settings", icon: Settings, label: "System Settings" },
  { to: "/super-admin/audit-logs", icon: ClipboardList, label: "Audit Logs" },
  { to: "/super-admin/monitoring", icon: Activity, label: "Monitoring" },
];

export default function SuperAdminSidebar() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const sidebarContent = (isMobile: boolean) => (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-accent-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <h2 className="font-bold text-sm leading-tight">Super Admin</h2>
            <p className="text-[11px] text-sidebar-foreground/60">Platform Control</p>
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

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/super-admin"}
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
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
          {(!collapsed || isMobile) && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button onClick={async () => { await signOut(); window.location.href = "/super-admin/login"; }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <LogOut className="h-5 w-5 shrink-0" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
          <Shield className="h-4 w-4 text-accent-foreground" />
        </div>
        <h2 className="font-bold text-sm text-sidebar-foreground">Super Admin</h2>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl animate-in slide-in-from-left duration-300">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      <aside className={cn("h-screen bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border transition-all duration-300 sticky top-0 hidden md:flex", collapsed ? "w-[68px]" : "w-64")}>
        {sidebarContent(false)}
      </aside>
    </>
  );
}

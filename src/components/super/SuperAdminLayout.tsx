import { useEffect, useState } from "react";
import { useNavigate, Link, Outlet, useLocation } from "react-router-dom";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Shield, LayoutDashboard, Building2, CreditCard, Globe, LogOut, Loader2,
  Package, MessageSquare, Rocket, BarChart3, Mail, Menu, X, ChevronLeft,
  Receipt, Palette, Sun, Moon, Users, ShieldCheck, Activity, FileText,
  Languages,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Language } from "@/i18n";
import { useTheme } from "next-themes";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/super/dashboard" },
    ],
  },
  {
    label: "Tenant Management",
    items: [
      { label: "Tenants", icon: Building2, path: "/super/tenants" },
      { label: "Onboarding", icon: Rocket, path: "/super/onboarding" },
      { label: "Domains", icon: Globe, path: "/super/domains" },
      { label: "Branding", icon: Palette, path: "/super/branding" },
      { label: "Landing Page", icon: FileText, path: "/super/landing-cms" },
      { label: "Demo Requests", icon: Rocket, path: "/super/demo-requests" },
    ],
  },
  {
    label: "Billing & Plans",
    items: [
      { label: "Plans", icon: Package, path: "/super/plans" },
      { label: "Subscriptions", icon: CreditCard, path: "/super/subscriptions" },
      { label: "Billing", icon: Receipt, path: "/super/billing" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "SMS Management", icon: MessageSquare, path: "/super/sms" },
      { label: "SMTP / Email", icon: Mail, path: "/super/smtp" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", icon: Users, path: "/super/users" },
      { label: "Roles & Permissions", icon: ShieldCheck, path: "/super/roles" },
      { label: "Analytics", icon: BarChart3, path: "/super/analytics" },
      { label: "Activity Logs", icon: Activity, path: "/super/activity-logs" },
    ],
  },
];

export default function SuperAdminLayout() {
  const { user, loading, logout } = useSuperAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleLang = () => setLanguage(language === "en" ? "bn" : "en");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/super/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Super Admin...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Header with gradient accent */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border/60 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <Shield className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight truncate text-sidebar-foreground">Super Admin</p>
            <p className="text-[10px] text-sidebar-foreground/40 font-medium">Smart ISP SaaS</p>
          </div>
        )}
        {isMobile ? (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2.5 space-y-3 overflow-y-auto sidebar-scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {(!collapsed || isMobile) && (
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">{group.label}</p>
            )}
            {collapsed && !isMobile && (
              <div className="mx-auto w-6 border-t border-sidebar-border/40 my-1" />
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path === "/super/tenants" && location.pathname.startsWith("/super/tenants/"));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group relative",
                    isActive
                      ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-primary/10 text-sidebar-primary shadow-sm"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
                  )}
                  <item.icon className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70"
                  )} />
                  {(!collapsed || isMobile) && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border/60 space-y-1 shrink-0">
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-all duration-200">
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {(!collapsed || isMobile) && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* User info */}
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2 text-sm",
          collapsed && !isMobile && "justify-center"
        )}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 ring-1 ring-primary/20">
            {user.name.charAt(0)}
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <span className="truncate text-sidebar-foreground text-sm font-medium block">{user.name}</span>
              <span className="text-[10px] text-sidebar-foreground/40">Administrator</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 rounded-xl",
            collapsed && !isMobile ? "justify-center px-0" : "justify-start"
          )}
          onClick={() => { logout(); navigate("/super/login"); }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border/60 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Shield className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm text-sidebar-foreground">Super Admin</span>
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

      {/* Main */}
      <main className="flex-1 overflow-auto main-scroll">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pt-[72px] md:pt-6 pb-6 animate-page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

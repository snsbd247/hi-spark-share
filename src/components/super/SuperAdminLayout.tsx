import { useEffect, useState } from "react";
import { useNavigate, Link, Outlet, useLocation } from "react-router-dom";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Shield, LayoutDashboard, Building2, CreditCard, Globe, LogOut, Loader2,
  Package, MessageSquare, Rocket, BarChart3, Mail, Menu, X, ChevronLeft,
  Receipt,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/super/dashboard" },
  { label: "Tenants", icon: Building2, path: "/super/tenants" },
  { label: "Onboarding", icon: Rocket, path: "/super/onboarding" },
  { label: "Plans", icon: Package, path: "/super/plans" },
  { label: "Subscriptions", icon: CreditCard, path: "/super/subscriptions" },
  { label: "Billing", icon: Receipt, path: "/super/billing" },
  { label: "Domains", icon: Globe, path: "/super/domains" },
  { label: "SMS Management", icon: MessageSquare, path: "/super/sms" },
  { label: "SMTP / Email", icon: Mail, path: "/super/smtp" },
  { label: "Analytics", icon: BarChart3, path: "/super/analytics" },
];

export default function SuperAdminLayout() {
  const { user, loading, logout } = useSuperAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/super/login");
    }
  }, [user, loading, navigate]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu open
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
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <Shield className="h-6 w-6 text-primary shrink-0" />
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">Super Admin</p>
            <p className="text-[10px] text-muted-foreground">Smart ISP SaaS</p>
          </div>
        )}
        {isMobile ? (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 shrink-0" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto sidebar-scroll">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === "/super/tenants" && location.pathname.startsWith("/super/tenants/"));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border shrink-0">
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground",
          collapsed && !isMobile && "justify-center"
        )}>
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {user.name.charAt(0)}
          </div>
          {(!collapsed || isMobile) && (
            <span className="truncate flex-1 text-foreground text-sm font-medium">{user.name}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full mt-1 text-muted-foreground hover:text-foreground",
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
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Super Admin</span>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col shadow-xl animate-in slide-in-from-left duration-300">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "h-screen bg-card border-r border-border flex-col transition-all duration-300 sticky top-0 hidden md:flex",
        collapsed ? "w-[68px]" : "w-64"
      )}>
        {sidebarContent(false)}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto pt-[72px] md:pt-6 pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

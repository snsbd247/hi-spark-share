import { useEffect, useState } from "react";
import { useNavigate, Link, Outlet } from "react-router-dom";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { Button } from "@/components/ui/button";
import { Shield, LayoutDashboard, Building2, CreditCard, Globe, LogOut, Loader2, Package, MessageSquare } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/super/dashboard" },
  { label: "Tenants", icon: Building2, path: "/super/tenants" },
  { label: "Plans", icon: Package, path: "/super/plans" },
  { label: "Subscriptions", icon: CreditCard, path: "/super/subscriptions" },
  { label: "Domains", icon: Globe, path: "/super/domains" },
  { label: "SMS Management", icon: MessageSquare, path: "/super/sms" },
];

export default function SuperAdminLayout() {
  const { user, loading, logout } = useSuperAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/super/login");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold text-sm">Super Admin</p>
            <p className="text-xs text-muted-foreground">Smart ISP SaaS</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {user.name.charAt(0)}
            </div>
            <span className="truncate flex-1">{user.name}</span>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start mt-1" onClick={() => { logout(); navigate("/super/login"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

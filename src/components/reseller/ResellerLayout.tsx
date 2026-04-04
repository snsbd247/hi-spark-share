import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Receipt, Wallet, LogOut, Wifi, Menu, X, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import DynamicFooter from "@/components/DynamicFooter";

const navItems = [
  { to: "/reseller/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/reseller/customers", icon: Users, label: "Customers" },
  { to: "/reseller/billing", icon: Receipt, label: "Billing" },
  { to: "/reseller/wallet", icon: Wallet, label: "Wallet" },
  { to: "/reseller/reports", icon: FileText, label: "Reports" },
  { to: "/reseller/profile", icon: User, label: "Profile" },
];

export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { reseller, signOut } = useResellerAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/reseller/login");
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
          <Wifi className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-sm truncate">Reseller Panel</h2>
          <p className="text-[10px] text-muted-foreground truncate">{reseller?.company_name || reseller?.name}</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
              location.pathname === item.to
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}>
            <item.icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
          <LogOut className="h-[18px] w-[18px]" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card shrink-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-xl">
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm">Reseller Panel</span>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
        <DynamicFooter />
      </div>
    </div>
  );
}

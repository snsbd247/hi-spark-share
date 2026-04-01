import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, CreditCard, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/billing", icon: Receipt, label: "Billing" },
  { to: "/payments", icon: CreditCard, label: "Payments" },
  { to: "/reporting/daily", icon: BarChart3, label: "Reports" },
];

export default function MobileBottomNav() {
  const location = useLocation();

  const hiddenPaths = ["/admin/login", "/login", "/portal", "/super", "/landing", "/pay-bill", "/force-password-change"];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {mobileNavItems.map(item => {
          const isActive = item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200 relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <Icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
              <span className={cn("text-[10px] font-medium leading-none", isActive && "font-semibold")}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

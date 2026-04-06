import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  billing: "Billing",
  payments: "Payments",
  expenses: "Expenses",
  employees: "Employees",
  attendance: "Attendance",
  payroll: "Payroll",
  settings: "Settings",
  reports: "Reports",
  resellers: "Resellers",
  packages: "Packages",
  "support-tickets": "Support Tickets",
  "sms-management": "SMS Management",
  "user-management": "Users & Roles",
  "activity-logs": "Activity Logs",
  "audit-logs": "Audit Logs",
  accounting: "Accounting",
  inventory: "Inventory",
  suppliers: "Suppliers",
  "mikrotik-config": "MikroTik Config",
  "fiber-topology": "Fiber Topology",
  "network-map": "Network Map",
  "customer-devices": "Customer Devices",
};

export default function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Skip for root or login pages
  if (segments.length <= 1 || segments.includes("login")) return null;

  // Skip for super admin and reseller (different layouts)
  if (segments[0] === "super" || segments[0] === "reseller" || segments[0] === "portal") return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
      <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const label = routeLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const isLast = i === segments.length - 1;

        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

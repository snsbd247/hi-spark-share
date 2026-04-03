import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Shield, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const actionColors: Record<string, string> = {
  login: "default",
  login_success: "default",
  login_requested: "secondary",
  login_approved: "default",
  login_approved_completed: "default",
  login_rejected: "destructive",
  customer_login: "default",
  logout: "outline",
};

export default function LoginLogs() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const actionLabels: Record<string, string> = {
    login: t.loginLogsPage.adminLogin,
    login_success: t.loginLogsPage.loginSuccess,
    login_requested: t.loginLogsPage.loginRequested,
    login_approved: t.loginLogsPage.approved,
    login_approved_completed: t.loginLogsPage.approvedCompleted,
    login_rejected: t.loginLogsPage.rejected,
    customer_login: t.loginLogsPage.customerLogin,
    logout: t.loginLogsPage.logout,
  };

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-login-logs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("admin_login_logs")
        .select("*, admin_sessions(device_name, browser, ip_address)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("id, full_name, email");
      return (data || []) as { id: string; full_name: string; email: string | null }[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-map-login"],
    queryFn: async () => {
      const { data } = await db.from("customers").select("id, name, customer_id");
      return (data || []) as { id: string; name: string; customer_id: string }[];
    },
  });

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
  const customerMap = new Map(customers?.map((c) => [c.id, c]) || []);

  const filtered = logs?.filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const profile = profileMap.get(log.admin_id);
    return (
      (log.action || "").toLowerCase().includes(s) ||
      log.ip_address?.toLowerCase().includes(s) ||
      log.browser?.toLowerCase().includes(s) ||
      log.device_name?.toLowerCase().includes(s) ||
      profile?.full_name?.toLowerCase().includes(s) ||
      profile?.email?.toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.loginLogsPage.title}</h1>
            <p className="text-muted-foreground text-sm">{t.loginLogsPage.subtitle}</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" /> {t.security.securityDashboard.split(" ")[0]}
          </Badge>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.loginLogsPage.searchLogs}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.auditLogsPage.time}</TableHead>
                  <TableHead>{t.auditLogsPage.admin}</TableHead>
                  <TableHead>{t.auditLogsPage.action}</TableHead>
                  <TableHead>{t.auditLogsPage.device}</TableHead>
                  <TableHead>{t.auditLogsPage.browser}</TableHead>
                  <TableHead>{t.auditLogsPage.ipAddress}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t.loginLogsPage.noLogsFound}
                    </TableCell>
                  </TableRow>
                )}
                {filtered?.map((log) => {
                  const profile = profileMap.get(log.admin_id);
                  const cust = customerMap.get(log.admin_id);
                  const isCustomer = log.action === "customer_login";
                  const displayName = isCustomer
                    ? (cust ? `${cust.name} (${cust.customer_id})` : log.admin_id.slice(0, 8))
                    : (profile?.full_name || profile?.email || log.admin_id.slice(0, 8));
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {safeFormat(log.created_at, "MMM dd, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {displayName}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionColors[log.action] as any || "secondary"}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.device_name || "—"}</TableCell>
                      <TableCell className="text-sm">{log.browser || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{log.ip_address || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
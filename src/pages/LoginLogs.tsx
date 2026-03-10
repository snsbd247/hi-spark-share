import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Shield, Loader2 } from "lucide-react";
import { format } from "date-fns";

const actionColors: Record<string, string> = {
  login_success: "default",
  login_requested: "secondary",
  login_approved: "default",
  login_approved_completed: "default",
  login_rejected: "destructive",
  logout: "outline",
};

const actionLabels: Record<string, string> = {
  login_success: "Login Success",
  login_requested: "Login Requested",
  login_approved: "Approved",
  login_approved_completed: "Approved (Complete)",
  login_rejected: "Rejected",
  logout: "Logout",
};

export default function LoginLogs() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-login-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
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
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data || []) as { id: string; full_name: string; email: string | null }[];
    },
  });

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

  const filtered = logs?.filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const profile = profileMap.get(log.admin_id);
    return (
      log.action.toLowerCase().includes(s) ||
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
            <h1 className="text-2xl font-bold text-foreground">Login Audit Logs</h1>
            <p className="text-muted-foreground text-sm">Track all admin login attempts, approvals, and logouts</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" /> Security
          </Badge>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
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
                  <TableHead>Time</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No login logs found
                    </TableCell>
                  </TableRow>
                )}
                {filtered?.map((log) => {
                  const profile = profileMap.get(log.admin_id);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {profile?.full_name || profile?.email || log.admin_id.slice(0, 8)}
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { IS_LOVABLE } from "@/lib/environment";
import api from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Search, Loader2, Filter } from "lucide-react";

export default function UserLoginHistory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["login-history"],
    queryFn: async () => {
      if (IS_LOVABLE) {
        const { data, error } = await db
          .from("login_histories" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data || [];
      }
      const { data } = await api.get("/login-history");
      return data || [];
    },
  });

  const filtered = (logs as any[]).filter((log: any) => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.device?.toLowerCase().includes(s) ||
      log.browser?.toLowerCase().includes(s) ||
      log.ip_address?.toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6" /> Login History
          </h1>
          <p className="text-muted-foreground text-sm">Track all login attempts in your system</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No login history found</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs capitalize">{log.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.device || "—"}</TableCell>
                        <TableCell className="text-sm">{log.browser || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.failure_reason || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

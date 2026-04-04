import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function TrafficMonitor() {
  const { t } = useLanguage();
  const tenantId = useTenantId();
  const { data: routers = [] } = useQuery({
    queryKey: ["routers-traffic", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant((db as any).from("mikrotik_routers").select("*"), tenantId); return data || []; },
    refetchInterval: 30000,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-traffic", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant((db as any).from("customers").select("id,name,customer_id,ip_address,connection_status,router_id,pppoe_username").eq("status", "active"), tenantId); return data || []; },
    refetchInterval: 30000,
  });

  const online = customers.filter((c: any) => c.connection_status === "online").length;
  const offline = customers.filter((c: any) => c.connection_status !== "online").length;

  const tableData = customers.map((c: any) => ({
    customer_id: c.customer_id || "",
    name: c.name || "",
    ip: c.ip_address || "",
    pppoe: c.pppoe_username || "",
    status: c.connection_status || "offline",
  }));

  const columns = [
    { header: "Customer ID", key: "customer_id" },
    { header: "Name", key: "name" },
    { header: "IP Address", key: "ip" },
    { header: "PPPoE", key: "pppoe" },
    { header: "Status", key: "status" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.sidebar.trafficMonitor}</h1>
          <Badge variant="outline" className="gap-1"><Activity className="h-3 w-3" />Auto-refresh: 30s</Badge>
        </div>

        <ReportToolbar title="Traffic Monitor Report" data={tableData} columns={columns} showDateFilter={false} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 flex items-center gap-3"><Wifi className="h-8 w-8 text-primary" /><div><div className="text-2xl font-bold">{online}</div><p className="text-sm text-muted-foreground">Online Users</p></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><WifiOff className="h-8 w-8 text-destructive" /><div><div className="text-2xl font-bold">{offline}</div><p className="text-sm text-muted-foreground">Offline Users</p></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><Activity className="h-8 w-8 text-muted-foreground" /><div><div className="text-2xl font-bold">{routers.length}</div><p className="text-sm text-muted-foreground">Routers</p></div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>PPPoE</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.slice(0, 100).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.customer_id}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.ip_address}</TableCell>
                    <TableCell className="text-xs">{c.pppoe_username}</TableCell>
                    <TableCell>
                      <Badge variant={c.connection_status === "online" ? "default" : "secondary"} className="text-xs">
                        {c.connection_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

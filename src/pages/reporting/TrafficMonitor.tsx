import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TrafficMonitor() {
  const { t } = useLanguage();
  const { data: routers = [], isLoading } = useQuery({
    queryKey: ["routers-traffic"],
    queryFn: async () => { const { data } = await ( supabase as any).from("mikrotik_routers").select("*"); return data || []; },
    refetchInterval: 30000,
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers-traffic"], queryFn: async () => { const { data } = await ( supabase as any).from("customers").select("id,name,ip_address,connection_status,router_id").eq("status", "active"); return data || []; }, refetchInterval: 30000 });

  const online = customers.filter((c: any) => c.connection_status === "online").length;
  const offline = customers.filter((c: any) => c.connection_status !== "online").length;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Traffic Monitor</h1>
        <Badge variant="outline" className="gap-1"><Activity className="h-3 w-3" />Auto-refresh: 30s</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6 flex items-center gap-3"><Wifi className="h-8 w-8 text-green-500" /><div><div className="text-2xl font-bold">{online}</div><p className="text-sm text-muted-foreground">Online Users</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><WifiOff className="h-8 w-8 text-red-500" /><div><div className="text-2xl font-bold">{offline}</div><p className="text-sm text-muted-foreground">Offline Users</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><Activity className="h-8 w-8 text-blue-500" /><div><div className="text-2xl font-bold">{routers.length}</div><p className="text-sm text-muted-foreground">Routers</p></div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Router Status</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Router Name</TableHead><TableHead>IP Address</TableHead><TableHead>API Port</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {routers.map((r: any) => (
                  <TableRow key={r.id}><TableCell className="font-medium">{r.name}</TableCell><TableCell className="font-mono">{r.ip_address}</TableCell><TableCell>{r.api_port}</TableCell><TableCell><Badge variant={r.status === "active" ? "default" : "destructive"}>{r.status}</Badge></TableCell></TableRow>
                ))}
                {routers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No routers configured</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

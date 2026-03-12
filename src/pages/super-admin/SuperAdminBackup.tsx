import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Database, Download, Loader2, HardDrive, Shield } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const ALL_TABLES = [
  "tenants", "tenant_subscriptions", "subscription_plans", "platform_admins", "system_settings",
  "profiles", "user_roles", "custom_roles", "permissions", "role_permissions",
  "customers", "packages", "bills", "payments", "merchant_payments",
  "customer_ledger", "customer_sessions", "zones", "mikrotik_routers", "olts", "onus",
  "support_tickets", "ticket_replies", "sms_logs", "sms_settings", "sms_templates",
  "reminder_logs", "audit_logs", "admin_sessions", "admin_login_logs", "backup_logs",
  "payment_gateways", "general_settings",
];

export default function SuperAdminBackup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState("platform");
  const [selectedTenant, setSelectedTenant] = useState("");

  const { data: tenants } = useQuery({
    queryKey: ["sa-backup-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants" as any).select("id, company_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: backupLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["sa-backup-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backup_logs" as any).select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const runBackup = useMutation({
    mutationFn: async () => {
      const backupData: Record<string, any[]> = {};
      const tables = scope === "platform" ? ALL_TABLES : ALL_TABLES.filter(t => !["tenants", "subscription_plans", "platform_admins", "system_settings", "tenant_subscriptions"].includes(t));

      for (const table of tables) {
        let query = supabase.from(table as any).select("*");
        if (scope === "tenant" && selectedTenant) {
          // Only fetch tenant-scoped data
          const { data } = await (query as any).eq("tenant_id", selectedTenant);
          backupData[table] = data || [];
        } else {
          const { data } = await query;
          backupData[table] = data || [];
        }
      }

      const tenantName = scope === "tenant" ? tenants?.find(t => t.id === selectedTenant)?.company_name || "unknown" : "platform";
      const fileName = `backup_${tenantName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmmss")}.json`;
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });

      // Upload to storage
      const { error: uploadError } = await supabase.storage.from("backups").upload(fileName, blob);
      if (uploadError) throw uploadError;

      // Log the backup
      await supabase.from("backup_logs" as any).insert({
        tenant_id: scope === "tenant" ? selectedTenant : null,
        backup_type: scope === "platform" ? "platform_full" : "tenant",
        file_name: fileName,
        file_size: blob.size,
        created_by: user?.id || "system",
        status: "completed",
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-backup-logs"] });
      toast.success("Backup completed and downloaded");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <SuperAdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Backup & Restore</h1>
        <p className="text-muted-foreground mt-1">Platform-wide and per-tenant database backups</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> Create Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Backup Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">Entire Platform (All Tenants)</SelectItem>
                  <SelectItem value="tenant">Single Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "tenant" && (
              <div>
                <Label>Select Tenant</Label>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger><SelectValue placeholder="Choose tenant..." /></SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => runBackup.mutate()} disabled={runBackup.isPending || (scope === "tenant" && !selectedTenant)} className="w-full">
              {runBackup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {runBackup.isPending ? "Creating Backup..." : "Generate & Download Backup"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Backups</span>
              <span className="font-medium">{backupLogs?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Backups</span>
              <span className="font-medium">{backupLogs?.filter((b: any) => b.backup_type === "platform_full").length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tenant Backups</span>
              <span className="font-medium">{backupLogs?.filter((b: any) => b.backup_type === "tenant").length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" /> Backup History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !backupLogs?.length ? (
            <div className="text-center py-12 text-muted-foreground"><p>No backups yet</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupLogs.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{b.file_name}</TableCell>
                    <TableCell><Badge variant="secondary">{b.backup_type}</Badge></TableCell>
                    <TableCell>{(b.file_size / 1024).toFixed(1)} KB</TableCell>
                    <TableCell><Badge variant={b.status === "completed" ? "default" : "destructive"}>{b.status}</Badge></TableCell>
                    <TableCell>{format(new Date(b.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}

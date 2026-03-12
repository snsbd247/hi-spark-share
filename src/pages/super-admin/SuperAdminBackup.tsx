import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Database, Download, Loader2, HardDrive, Shield, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
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

const TENANT_TABLES = ALL_TABLES.filter(t => !["tenants", "subscription_plans", "platform_admins", "system_settings", "tenant_subscriptions"].includes(t));

export default function SuperAdminBackup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState("platform");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [restoreDialog, setRestoreDialog] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: tenants } = useQuery({
    queryKey: ["sa-backup-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, company_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: backupLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["sa-backup-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backup_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      // Attach tenant names
      const logs = (data || []) as any[];
      const tenantIds = [...new Set(logs.filter(b => b.tenant_id).map(b => b.tenant_id))];
      let tenantMap: Record<string, string> = {};
      if (tenantIds.length) {
        const { data: tData } = await supabase.from("tenants").select("id, company_name").in("id", tenantIds);
        (tData || []).forEach((t: any) => { tenantMap[t.id] = t.company_name; });
      }
      return logs.map(b => ({ ...b, tenant_name: b.tenant_id ? tenantMap[b.tenant_id] || "Unknown" : "—" }));
    },
  });

  const runBackup = useMutation({
    mutationFn: async () => {
      const backupData: Record<string, any[]> = {};
      const tables = scope === "platform" ? ALL_TABLES : TENANT_TABLES;

      for (const table of tables) {
        let query = (supabase as any).from(table).select("*");
        if (scope === "tenant" && selectedTenant) {
          const { data } = await query.eq("tenant_id", selectedTenant);
          backupData[table] = data || [];
        } else {
          const { data } = await query;
          backupData[table] = data || [];
        }
      }

      // Generate SQL dump
      const sqlLines: string[] = [
        `-- ISP Platform Backup`,
        `-- Generated: ${new Date().toISOString()}`,
        `-- Scope: ${scope === "platform" ? "Full Platform" : "Tenant: " + (tenants?.find(t => t.id === selectedTenant)?.company_name || selectedTenant)}`,
        `-- Format: PostgreSQL compatible SQL`,
        ``,
        `BEGIN;`,
        ``,
      ];

      for (const table of tables) {
        const rows = backupData[table];
        if (!rows?.length) continue;

        sqlLines.push(`-- Table: ${table} (${rows.length} rows)`);

        // DELETE existing data for tenant-scoped restore
        if (scope === "tenant" && selectedTenant) {
          sqlLines.push(`DELETE FROM public.${table} WHERE tenant_id = '${selectedTenant}';`);
        } else {
          sqlLines.push(`TRUNCATE TABLE public.${table} CASCADE;`);
        }

        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
            if (typeof val === "number") return String(val);
            if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sqlLines.push(`INSERT INTO public.${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`);
        }
        sqlLines.push(``);
      }

      sqlLines.push(`COMMIT;`);

      const tenantName = scope === "tenant" ? tenants?.find(t => t.id === selectedTenant)?.company_name || "unknown" : "platform";
      const fileName = `backup_${tenantName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmmss")}.sql`;
      const sqlContent = sqlLines.join("\n");
      const blob = new Blob([sqlContent], { type: "application/sql" });

      await supabase.storage.from("backups").upload(fileName, blob);

      await (supabase as any).from("backup_logs").insert({
        tenant_id: scope === "tenant" ? selectedTenant : null,
        backup_type: scope === "platform" ? "platform_full" : "tenant",
        file_name: fileName,
        file_size: blob.size,
        created_by: user?.id || "system",
        status: "completed",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-backup-logs"] });
      toast.success("Backup completed and downloaded");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleDownload = async (backup: any) => {
    try {
      const { data, error } = await supabase.storage.from("backups").download(backup.file_name);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = backup.file_name; a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    }
  };

  const handleRestore = async () => {
    if (!restoreDialog) return;
    setRestoring(true);
    try {
      const { data: fileData, error } = await supabase.storage.from("backups").download(restoreDialog.file_name);
      if (error) throw error;
      const text = await fileData.text();

      // Parse SQL backup: extract INSERT statements and replay via Supabase client
      const tables = restoreDialog.backup_type === "tenant" ? TENANT_TABLES : ALL_TABLES;
      const tenantId = restoreDialog.tenant_id;

      // Step 1: Delete existing data in reverse dependency order
      for (const table of [...tables].reverse()) {
        if (tenantId) {
          await (supabase as any).from(table).delete().eq("tenant_id", tenantId);
        }
      }

      // Step 2: Parse INSERT statements from SQL and re-insert via client
      const insertRegex = /INSERT INTO public\.(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+)\);/g;
      const rowsByTable: Record<string, any[]> = {};

      let match;
      while ((match = insertRegex.exec(text)) !== null) {
        const tableName = match[1];
        const columns = match[2].split(",").map(c => c.trim());
        const rawValues = match[3];

        // Parse values carefully handling quoted strings with commas
        const values: any[] = [];
        let current = "";
        let inQuote = false;
        let depth = 0;
        for (let i = 0; i < rawValues.length; i++) {
          const ch = rawValues[i];
          if (ch === "'" && rawValues[i - 1] !== "'") {
            inQuote = !inQuote;
            current += ch;
          } else if (!inQuote && ch === "," && depth === 0) {
            values.push(current.trim());
            current = "";
          } else {
            if (ch === "(") depth++;
            if (ch === ")") depth--;
            current += ch;
          }
        }
        if (current.trim()) values.push(current.trim());

        const row: Record<string, any> = {};
        columns.forEach((col, i) => {
          const val = values[i] || "NULL";
          if (val === "NULL") { row[col] = null; }
          else if (val === "TRUE") { row[col] = true; }
          else if (val === "FALSE") { row[col] = false; }
          else if (val.startsWith("'") && val.endsWith("'")) {
            row[col] = val.slice(1, -1).replace(/''/g, "'");
          } else if (val.endsWith("::jsonb")) {
            const jsonStr = val.replace(/::jsonb$/, "").slice(1, -1).replace(/''/g, "'");
            try { row[col] = JSON.parse(jsonStr); } catch { row[col] = jsonStr; }
          } else if (!isNaN(Number(val))) {
            row[col] = Number(val);
          } else {
            row[col] = val;
          }
        });

        if (!rowsByTable[tableName]) rowsByTable[tableName] = [];
        rowsByTable[tableName].push(row);
      }

      // Insert in table order
      for (const table of tables) {
        const rows = rowsByTable[table];
        if (rows?.length) {
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            await (supabase as any).from(table).insert(batch);
          }
        }
      }

      toast.success("Restore completed successfully");
      setRestoreDialog(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await supabase.storage.from("backups").remove([deleteDialog.file_name]);
      await (supabase as any).from("backup_logs").delete().eq("id", deleteDialog.id);
      toast.success("Backup deleted");
      setDeleteDialog(null);
      queryClient.invalidateQueries({ queryKey: ["sa-backup-logs"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

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
                  <TableHead>Tenant</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupLogs.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{b.file_name}</TableCell>
                    <TableCell><Badge variant="secondary">{b.backup_type}</Badge></TableCell>
                    <TableCell className="text-sm">{b.tenant_name}</TableCell>
                    <TableCell>{(b.file_size / 1024).toFixed(1)} KB</TableCell>
                    <TableCell><Badge variant={b.status === "completed" ? "default" : "destructive"}>{b.status}</Badge></TableCell>
                    <TableCell>{format(new Date(b.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(b)} title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRestoreDialog(b)} title="Restore">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog(b)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Backup</DialogTitle>
            <DialogDescription>Are you sure you want to permanently delete "{deleteDialog?.file_name}"? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <Dialog open={!!restoreDialog} onOpenChange={() => setRestoreDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" /> Restore Backup</DialogTitle>
            <DialogDescription>
              Restoring "{restoreDialog?.file_name}" will replace current data
              {restoreDialog?.backup_type === "tenant" ? " for this tenant" : " across the entire platform"}.
              This operation cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialog(null)}>Cancel</Button>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />} Restore Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}

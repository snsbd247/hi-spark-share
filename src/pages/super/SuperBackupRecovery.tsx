import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Database, Download, Upload, Trash2, Shield, RefreshCw, Clock, HardDrive, CheckCircle, XCircle, Loader2, RotateCcw, Settings } from "lucide-react";
import { superAdminApi } from "@/lib/superAdminApi";

interface BackupLog {
  id: string;
  file_name: string;
  file_size: number;
  backup_type: string;
  status: string;
  created_by: string;
  created_at: string;
}

interface AutoSettings {
  enabled: boolean;
  frequency: string;
  keep_count: number;
}

export default function SuperBackupRecovery() {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoSettings, setAutoSettings] = useState<AutoSettings>({ enabled: false, frequency: "daily", keep_count: 10 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, tenantsRes, settingsRes] = await Promise.all([
        superAdminApi.getBackupLogs(),
        superAdminApi.getTenants(),
        superAdminApi.getAutoBackupSettings(),
      ]);
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      const t = Array.isArray(tenantsRes) ? tenantsRes : tenantsRes?.tenants || [];
      setTenants(t);
      setAutoSettings(settingsRes || { enabled: false, frequency: "daily", keep_count: 10 });
    } catch (e) {
      console.error("Failed to load backup data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  const createFullBackup = async () => {
    setActionLoading("full");
    try {
      const res = await superAdminApi.createFullBackup();
      const d = res?.data || res;
      const fileName = d?.file_name || d?.filename || "backup";
      const size = d?.size || d?.file_size;
      const sizeStr = size ? ` (${formatSize(size)})` : "";
      toast.success(`Full backup created: ${fileName}${sizeStr}`);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Backup failed");
    } finally {
      setActionLoading(null);
    }
  };

  const createTenantBackup = async () => {
    if (!selectedTenant) { toast.error("Select a tenant first"); return; }
    setActionLoading("tenant");
    try {
      const res = await superAdminApi.createTenantBackup(selectedTenant);
      const d = res?.data || res;
      const fileName = d?.file_name || d?.filename || "backup";
      const tenantName = d?.tenant_name ? ` [${d.tenant_name}]` : "";
      toast.success(`Tenant backup created: ${fileName}${tenantName}`);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Backup failed");
    } finally {
      setActionLoading(null);
    }
  };

  const restoreBackup = async (log: BackupLog) => {
    setActionLoading(`restore-${log.id}`);
    const isFullRestore = log.backup_type === "full";
    const filePath = isFullRestore
      ? `backups/full/${log.file_name}`
      : `backups/tenants/${extractTenantId(log.file_name)}/${log.file_name}`;

    try {
      if (isFullRestore) {
        await superAdminApi.restoreFullBackup(filePath);
      } else {
        const tenantId = extractTenantId(log.file_name);
        await superAdminApi.restoreTenantBackup(tenantId, filePath);
      }
      toast.success("Restore completed successfully!");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Restore failed");
    } finally {
      setActionLoading(null);
    }
  };

  const rollback = async (type: "full" | "tenant") => {
    setActionLoading("rollback");
    try {
      await superAdminApi.rollbackBackup(type, type === "tenant" ? selectedTenant : undefined);
      toast.success("Rollback completed!");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Rollback failed");
    } finally {
      setActionLoading(null);
    }
  };

  const verifyBackup = async (log: BackupLog) => {
    setActionLoading(`verify-${log.id}`);
    const filePath = log.backup_type === "full"
      ? `backups/full/${log.file_name}`
      : `backups/tenants/${extractTenantId(log.file_name)}/${log.file_name}`;
    try {
      const res = await superAdminApi.verifyBackup(filePath);
      if (res.valid) {
        toast.success(`Backup verified! ${res.lines} lines, ${res.has_data ? "has data" : "no data"}`);
      } else {
        toast.error("Backup verification failed");
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteBackup = async (log: BackupLog) => {
    setActionLoading(`delete-${log.id}`);
    const filePath = log.backup_type === "full"
      ? `backups/full/${log.file_name}`
      : `backups/tenants/${extractTenantId(log.file_name)}/${log.file_name}`;
    try {
      await superAdminApi.deleteBackup(filePath);
      toast.success("Backup deleted");
      await loadData();
    } catch {
      toast.error("Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const saveAutoSettings = async () => {
    setActionLoading("auto");
    try {
      await superAdminApi.updateAutoBackupSettings(autoSettings);
      toast.success("Auto backup settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setActionLoading(null);
    }
  };

  const extractTenantId = (fileName: string) => {
    const match = fileName.match(/tenant_([a-f0-9-]+)_backup/);
    return match?.[1] || "";
  };

  const typeColor = (type: string) => {
    if (type === "full") return "default";
    if (type === "tenant") return "secondary";
    if (type.includes("restore")) return "destructive";
    return "outline";
  };

  const fullLogs = logs.filter(l => l.backup_type === "full" || l.backup_type === "full_restore");
  const tenantLogs = logs.filter(l => l.backup_type === "tenant" || l.backup_type === "tenant_restore");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Backup & Recovery</h1>
        <p className="text-sm text-muted-foreground">Create, restore, and manage system backups</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Database className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{fullLogs.filter(l => l.backup_type === "full").length}</p>
                <p className="text-xs text-muted-foreground">Full Backups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/50"><HardDrive className="h-5 w-5 text-secondary-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{tenantLogs.filter(l => l.backup_type === "tenant").length}</p>
                <p className="text-xs text-muted-foreground">Tenant Backups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent"><CheckCircle className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.status === "completed").length}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><Clock className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{formatSize(logs.reduce((s, l) => s + (l.file_size || 0), 0))}</p>
                <p className="text-xs text-muted-foreground">Total Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="full" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="full">Full Backup</TabsTrigger>
          <TabsTrigger value="tenant">Tenant Backup</TabsTrigger>
          <TabsTrigger value="rollback">Rollback</TabsTrigger>
          <TabsTrigger value="settings">Auto Backup</TabsTrigger>
        </TabsList>

        {/* ── Full Backup Tab ── */}
        <TabsContent value="full" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Full System Backup</CardTitle>
              <CardDescription>Create a complete SQL backup of the entire database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={createFullBackup} disabled={actionLoading === "full"} className="w-full sm:w-auto">
                {actionLoading === "full" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                Create Full Backup
              </Button>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">File Name</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Size</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No full backups yet</td></tr>
                    )}
                    {fullLogs.map(log => (
                      <tr key={log.id} className="border-t">
                        <td className="p-3 font-mono text-xs break-all">{log.file_name}</td>
                        <td className="p-3"><Badge variant={typeColor(log.backup_type)}>{log.backup_type}</Badge></td>
                        <td className="p-3">{formatSize(log.file_size)}</td>
                        <td className="p-3 text-xs">{formatDate(log.created_at)}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => verifyBackup(log)} disabled={!!actionLoading}>
                              {actionLoading === `verify-${log.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                            </Button>
                            {!log.backup_type.includes("restore") && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={!!actionLoading}>
                                    <Upload className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Full Restore</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will restore the ENTIRE database from <strong>{log.file_name}</strong>. A safety backup will be created first. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => restoreBackup(log)}>Restore</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={!!actionLoading}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete {log.file_name}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteBackup(log)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tenant Backup Tab ── */}
        <TabsContent value="tenant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Tenant Backup</CardTitle>
              <CardDescription>Create tenant-specific SQL backups filtered by tenant_id</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={createTenantBackup} disabled={actionLoading === "tenant" || !selectedTenant}>
                  {actionLoading === "tenant" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                  Create Tenant Backup
                </Button>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">File Name</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Size</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No tenant backups yet</td></tr>
                    )}
                    {tenantLogs.map(log => (
                      <tr key={log.id} className="border-t">
                        <td className="p-3 font-mono text-xs break-all">{log.file_name}</td>
                        <td className="p-3"><Badge variant={typeColor(log.backup_type)}>{log.backup_type}</Badge></td>
                        <td className="p-3">{formatSize(log.file_size)}</td>
                        <td className="p-3 text-xs">{formatDate(log.created_at)}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => verifyBackup(log)} disabled={!!actionLoading}>
                              {actionLoading === `verify-${log.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                            </Button>
                            {!log.backup_type.includes("restore") && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={!!actionLoading}>
                                    <Upload className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Tenant Restore</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will restore tenant data from <strong>{log.file_name}</strong>. Existing tenant data will be replaced. A safety backup will be created first.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => restoreBackup(log)}>Restore</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={!!actionLoading}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                                  <AlertDialogDescription>Permanently delete {log.file_name}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteBackup(log)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rollback Tab ── */}
        <TabsContent value="rollback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> One-Click Rollback</CardTitle>
              <CardDescription>Instantly restore to the most recent backup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-dashed">
                  <CardContent className="pt-6 space-y-3">
                    <h3 className="font-semibold">Full System Rollback</h3>
                    <p className="text-sm text-muted-foreground">Restore the entire system to the last full backup point.</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={!!actionLoading}>
                          {actionLoading === "rollback" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                          Rollback System
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>⚠️ Full System Rollback</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will restore the ENTIRE database to the last full backup. A safety backup will be created before rollback. Are you absolutely sure?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => rollback("full")}>Rollback Now</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="pt-6 space-y-3">
                    <h3 className="font-semibold">Tenant Rollback</h3>
                    <p className="text-sm text-muted-foreground">Restore a specific tenant to their last backup.</p>
                    <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={!!actionLoading || !selectedTenant}>
                          <RotateCcw className="h-4 w-4 mr-2" /> Rollback Tenant
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Tenant Rollback</AlertDialogTitle>
                          <AlertDialogDescription>This will restore the selected tenant to their last backup point.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => rollback("tenant")}>Rollback</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>

              {/* Recent backups timeline */}
              <div>
                <h3 className="font-semibold mb-3">Recent Backup History</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {logs.slice(0, 20).map(log => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border text-sm">
                      {log.status === "completed" ? (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate">{log.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                      </div>
                      <Badge variant={typeColor(log.backup_type)} className="shrink-0">{log.backup_type}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(log.file_size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Auto Backup Settings Tab ── */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Auto Backup Settings</CardTitle>
              <CardDescription>Configure automated backup scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <Label className="text-base font-medium">Enable Auto Backup</Label>
                  <p className="text-sm text-muted-foreground">Automatically create system backups on schedule</p>
                </div>
                <Switch
                  checked={autoSettings.enabled}
                  onCheckedChange={(v) => setAutoSettings(p => ({ ...p, enabled: v }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={autoSettings.frequency}
                    onValueChange={(v) => setAutoSettings(p => ({ ...p, frequency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (2:30 AM)</SelectItem>
                      <SelectItem value="weekly">Weekly (Sunday 3 AM)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st, 3 AM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Keep Last N Backups</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={autoSettings.keep_count}
                    onChange={(e) => setAutoSettings(p => ({ ...p, keep_count: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>

              <Button onClick={saveAutoSettings} disabled={actionLoading === "auto"}>
                {actionLoading === "auto" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

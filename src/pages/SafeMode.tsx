import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Download, Upload, HardDrive, Activity, RefreshCw,
  Loader2, CheckCircle2, XCircle, Shield,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DiagnosticResult {
  name: string;
  status: "ok" | "error" | "checking";
  message: string;
}

interface SafeModeProps {
  onDismiss: () => void;
  errorMessage?: string | null;
}

export default function SafeMode({ onDismiss, errorMessage }: SafeModeProps) {
  const { toast } = useToast();
  const [restoring, setRestoring] = useState(false);
  const [creatingEmergency, setCreatingEmergency] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [latestBackup, setLatestBackup] = useState<string | null>(null);
  const [restoreLatestDialog, setRestoreLatestDialog] = useState(false);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    const results: DiagnosticResult[] = [];

    // Check DB connection
    try {
      const { error } = await supabase.from("general_settings").select("id").limit(1);
      results.push({
        name: "Database Connection",
        status: error ? "error" : "ok",
        message: error ? error.message : "Connected",
      });
    } catch (err: any) {
      results.push({ name: "Database Connection", status: "error", message: err.message });
    }

    // Check Auth service
    try {
      const { error } = await supabase.auth.getSession();
      results.push({
        name: "Authentication Service",
        status: error ? "error" : "ok",
        message: error ? error.message : "Operational",
      });
    } catch (err: any) {
      results.push({ name: "Authentication Service", status: "error", message: err.message });
    }

    // Check Storage
    try {
      const { error } = await supabase.storage.from("backups").list("", { limit: 1 });
      results.push({
        name: "Storage Service",
        status: error ? "error" : "ok",
        message: error ? error.message : "Operational",
      });
    } catch (err: any) {
      results.push({ name: "Storage Service", status: "error", message: err.message });
    }

    // Check Edge Functions
    try {
      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/backup-restore`,
        { method: "OPTIONS" }
      );
      results.push({
        name: "Edge Functions",
        status: response.ok ? "ok" : "error",
        message: response.ok ? "Operational" : `Status ${response.status}`,
      });
    } catch (err: any) {
      results.push({ name: "Edge Functions", status: "error", message: err.message });
    }

    // Check tables accessibility
    const tables = ["customers", "bills", "payments", "packages"];
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
        results.push({
          name: `Table: ${table}`,
          status: error ? "error" : "ok",
          message: error ? error.message : "Accessible",
        });
      } catch (err: any) {
        results.push({ name: `Table: ${table}`, status: "error", message: err.message });
      }
    }

    setDiagnostics(results);
    setRunningDiagnostics(false);
  };

  const loadBackupFiles = async () => {
    setLoadingBackups(true);
    try {
      // Load from both buckets
      const [backupsRes, emergencyRes] = await Promise.all([
        supabase.storage.from("backups").list(),
        supabase.storage.from("emergency").list(),
      ]);
      const files: string[] = [];
      if (backupsRes.data) files.push(...backupsRes.data.filter(f => f.name).map((f) => `backups/${f.name}`));
      if (emergencyRes.data) files.push(...emergencyRes.data.filter(f => f.name).map((f) => `emergency/${f.name}`));
      setBackupFiles(files);
      if (files.length > 0) setLatestBackup(files[0]);
    } catch (err: any) {
      toast({ title: "Failed to load backups", description: err.message, variant: "destructive" });
    }
    setLoadingBackups(false);
  };

  const handleDownload = async (filePath: string) => {
    try {
      const [bucket, ...rest] = filePath.split("/");
      const fileName = rest.join("/");
      const { data, error } = await supabase.storage.from(bucket).download(fileName);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    }
  };

  const createEmergencyBackup = async () => {
    setCreatingEmergency(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "emergency" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Emergency Backup Created", description: `File: ${data.file_name}` });
      loadBackupFiles();
    } catch (err: any) {
      toast({ title: "Emergency Backup Failed", description: err.message, variant: "destructive" });
    }
    setCreatingEmergency(false);
  };

  const restoreFromFile = async (file: File) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);
      if (!backupData.tables) throw new Error("Invalid backup structure");
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "restore", backup_data: backupData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Restore Complete",
        description: data.errors?.length ? `Restored with ${data.errors.length} warning(s)` : "Database restored successfully",
      });
      setRestoreDialogOpen(false);
      setRestoreFile(null);
    } catch (err: any) {
      toast({ title: "Restore Failed", description: err.message, variant: "destructive" });
    }
    setRestoring(false);
  };

  const restoreLatestBackup = async () => {
    if (!latestBackup) return;
    setRestoring(true);
    try {
      const [bucket, ...rest] = latestBackup.split("/");
      const fileName = rest.join("/");
      const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(fileName);
      if (dlError) throw dlError;
      const text = await fileData.text();
      const backupData = JSON.parse(text);
      if (!backupData.tables) throw new Error("Invalid backup structure");
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "restore", backup_data: backupData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Restore Complete", description: "Database restored from latest backup" });
      setRestoreLatestDialog(false);
    } catch (err: any) {
      toast({ title: "Restore Failed", description: err.message, variant: "destructive" });
    }
    setRestoring(false);
  };

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreDialogOpen(true);
    }
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-destructive/5 flex flex-col">
      {/* Emergency Header */}
      <div className="bg-destructive text-destructive-foreground px-6 py-4 flex items-center gap-3 shadow-lg">
        <Shield className="h-7 w-7" />
        <div className="flex-1">
          <h1 className="text-lg font-bold">⚠ Emergency Safe Mode</h1>
          <p className="text-sm opacity-90">
            System instability detected. Use recovery tools below.
          </p>
        </div>
        <Button variant="outline" size="sm" className="bg-transparent border-destructive-foreground/30 text-destructive-foreground hover:bg-destructive-foreground/10" onClick={onDismiss}>
          Exit Safe Mode
        </Button>
      </div>

      {errorMessage && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Last error: {errorMessage}</span>
        </div>
      )}

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Restore Latest Backup
              </CardTitle>
              <CardDescription>One-click restore from the most recent backup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!latestBackup && (
                <Button variant="outline" size="sm" className="w-full" onClick={loadBackupFiles} disabled={loadingBackups}>
                  {loadingBackups ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning...</> : "Find Latest Backup"}
                </Button>
              )}
              {latestBackup && (
                <>
                  <p className="text-xs text-muted-foreground font-mono truncate">{latestBackup}</p>
                  <Button className="w-full" onClick={() => setRestoreLatestDialog(true)} disabled={restoring}>
                    {restoring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restoring...</> : "Restore Now"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Backup File
              </CardTitle>
              <CardDescription>Restore from a local backup file</CardDescription>
            </CardHeader>
            <CardContent>
              <label>
                <input type="file" accept=".json" className="hidden" onChange={handleRestoreFileSelect} disabled={restoring} />
                <Button variant="outline" className="w-full" asChild disabled={restoring}>
                  <span><Upload className="h-4 w-4 mr-2" /> Select Backup File</span>
                </Button>
              </label>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Emergency Backup
              </CardTitle>
              <CardDescription>Create emergency backup before further issues</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={createEmergencyBackup} disabled={creatingEmergency}>
                {creatingEmergency ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : <><HardDrive className="h-4 w-4 mr-2" /> Create Emergency Backup</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Diagnostics & Downloads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                System Diagnostics
              </CardTitle>
              <CardDescription>Check system components health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={runDiagnostics} disabled={runningDiagnostics} variant="outline" className="w-full">
                {runningDiagnostics ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</> : <><Activity className="h-4 w-4 mr-2" /> Run Diagnostics</>}
              </Button>
              {diagnostics.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {diagnostics.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                      {d.status === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="font-medium flex-1">{d.name}</span>
                      <Badge variant={d.status === "ok" ? "default" : "destructive"} className="text-xs">
                        {d.message}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Available Backups
              </CardTitle>
              <CardDescription>Download existing backup files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={loadBackupFiles} disabled={loadingBackups} variant="outline" className="w-full">
                {loadingBackups ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</> : <><RefreshCw className="h-4 w-4 mr-2" /> Load Backups</>}
              </Button>
              {backupFiles.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {backupFiles.map((f) => (
                    <div key={f} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                      <HardDrive className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-xs flex-1 truncate">{f}</span>
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(f)}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Click "Load Backups" to scan storage</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Restart */}
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-sm">Restart System</p>
              <p className="text-xs text-muted-foreground">Reload the application and re-check connections</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Restart
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Restore Latest Dialog */}
      <AlertDialog open={restoreLatestDialog} onOpenChange={setRestoreLatestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Restore Latest Backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace all existing data</strong> with the backup. This cannot be undone.
              <span className="block mt-2 font-mono text-xs">{latestBackup}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={restoreLatestBackup}>
              {restoring ? "Restoring..." : "Yes, Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Restore Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Restore from File
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace all existing data</strong>. This action cannot be undone.
              {restoreFile && <span className="block mt-2 font-mono text-xs">File: {restoreFile.name}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => restoreFile && restoreFromFile(restoreFile)}
            >
              {restoring ? "Restoring..." : "Yes, Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

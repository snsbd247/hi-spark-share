import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Download, Trash2, Upload, Database, HardDrive, Loader2, AlertTriangle,
  Clock, Calendar, CalendarDays, Recycle, FileCode,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function BackupRestore() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backup-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createBackup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "create" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Backup Created", description: `File: ${data.file_name} (${formatFileSize(data.file_size)})` });
      queryClient.invalidateQueries({ queryKey: ["backup-logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Backup Failed", description: err.message, variant: "destructive" });
    },
  });
  const createSqlBackup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "create_sql" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      toast({ title: "SQL Backup Created", description: `File: ${data.file_name} (${formatFileSize(data.file_size)})` });
      queryClient.invalidateQueries({ queryKey: ["backup-logs"] });
      // Auto-download the SQL file
      try {
        const { data: fileData, error } = await supabase.storage.from("backups").download(data.file_name);
        if (!error && fileData) {
          const url = URL.createObjectURL(fileData);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.file_name;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch {}
    },
    onError: (err: any) => {
      toast({ title: "SQL Backup Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteBackup = useMutation({
    mutationFn: async (fileName: string) => {
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "delete", file_name: fileName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Backup Deleted" });
      queryClient.invalidateQueries({ queryKey: ["backup-logs"] });
      setDeleteDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const cleanupBackups = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "manual_cleanup" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${data.deleted} of ${data.total_found} old backups`,
      });
      queryClient.invalidateQueries({ queryKey: ["backup-logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Cleanup Failed", description: err.message, variant: "destructive" });
    },
  });

  const restoreBackup = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const isSql = file.name.endsWith(".sql");

      if (isSql) {
        // Send raw SQL text to the edge function for SQL restore
        const { data, error } = await supabase.functions.invoke("backup-restore", {
          body: { action: "restore_sql", sql_content: text },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
      } else {
        let backupData;
        try {
          backupData = JSON.parse(text);
        } catch {
          throw new Error("Invalid backup file format. Expected JSON or SQL.");
        }
        if (!backupData.tables) throw new Error("Invalid backup structure - missing tables");
        const { data, error } = await supabase.functions.invoke("backup-restore", {
          body: { action: "restore", backup_data: backupData },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
      }
    },
    onSuccess: (data) => {
      const msg = data.errors?.length
        ? `Restored with ${data.errors.length} warning(s)`
        : "Database restored successfully";
      toast({ title: "Restore Complete", description: msg });
      setRestoreDialogOpen(false);
      setRestoreFile(null);
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast({ title: "Restore Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleDownload = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("backups").download(fileName);
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

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreDialogOpen(true);
    }
    e.target.value = "";
  };

  const getTypeBadgeVariant = (type: string) => {
    if (type.includes("daily")) return "secondary";
    if (type.includes("weekly")) return "outline";
    if (type.includes("monthly")) return "default";
    if (type === "emergency") return "destructive";
    return "default";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backup & Restore</h1>
          <p className="text-muted-foreground">Manage database backups, schedules, and restore from previous snapshots</p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Create Backup
              </CardTitle>
              <CardDescription>Export all tables as backup</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => createBackup.mutate()}
                disabled={createBackup.isPending}
                className="w-full"
              >
                {createBackup.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><HardDrive className="h-4 w-4 mr-2" /> Create Backup</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                SQL Backup
              </CardTitle>
              <CardDescription>Export as SQL INSERT statements</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => createSqlBackup.mutate()}
                disabled={createSqlBackup.isPending}
                className="w-full"
              >
                {createSqlBackup.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating SQL...</>
                ) : (
                  <><FileCode className="h-4 w-4 mr-2" /> Download SQL Backup</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Download Backup
              </CardTitle>
              <CardDescription>Create and download immediately</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await createBackup.mutateAsync();
                    const { data } = await supabase
                      .from("backup_logs")
                      .select("file_name")
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .single();
                    if (data) handleDownload(data.file_name);
                  } catch {}
                }}
                disabled={createBackup.isPending}
                className="w-full"
              >
                {createBackup.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Download Full Backup</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-5 w-5 text-destructive" />
                Restore Backup
              </CardTitle>
              <CardDescription>Upload JSON or SQL backup to restore</CardDescription>
            </CardHeader>
            <CardContent>
              <label>
                <input type="file" accept=".json,.sql" className="hidden" onChange={handleRestoreFileSelect} disabled={restoreBackup.isPending} />
                <Button variant="destructive" className="w-full" asChild disabled={restoreBackup.isPending}>
                  <span>
                    {restoreBackup.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restoring...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Upload & Restore</>
                    )}
                  </span>
                </Button>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Recycle className="h-5 w-5 text-primary" />
                Cleanup Old Backups
              </CardTitle>
              <CardDescription>Remove backups older than 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => cleanupBackups.mutate()}
                disabled={cleanupBackups.isPending}
                className="w-full"
              >
                {cleanupBackups.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cleaning...</>
                ) : (
                  <><Recycle className="h-4 w-4 mr-2" /> Run Cleanup</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Auto Backup Schedule Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automatic Backup Schedule</CardTitle>
            <CardDescription>Backups run automatically. Old backups (&gt;30 days) are cleaned up daily.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Daily Backup</p>
                  <p className="text-xs text-muted-foreground">Every day at 2:00 AM</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Active</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Weekly Backup</p>
                  <p className="text-xs text-muted-foreground">Every Sunday at 3:00 AM</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Active</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Monthly Backup</p>
                  <p className="text-xs text-muted-foreground">1st of each month at 4:00 AM</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Active</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              ⚡ Max backup size: 100MB &middot; 🗑️ Auto-cleanup: Daily at 5:00 AM (removes backups older than 30 days, excludes emergency backups)
            </p>
          </CardContent>
        </Card>

        {/* Backup History */}
        <Card>
          <CardHeader>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>View and manage previous backups</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No backups found. Create your first backup above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Backup Date</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup: any) => (
                    <TableRow key={backup.id}>
                      <TableCell>{format(new Date(backup.created_at), "dd MMM yyyy, hh:mm a")}</TableCell>
                      <TableCell className="font-mono text-sm">{backup.file_name}</TableCell>
                      <TableCell>{formatFileSize(backup.file_size)}</TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadgeVariant(backup.backup_type)}>
                          {backup.backup_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={backup.status === "completed" ? "default" : "destructive"}>
                          {backup.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {backup.status === "completed" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDownload(backup.file_name)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setSelectedFile(backup.file_name); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Restore Database
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace all existing data</strong> with the backup data.
              This action cannot be undone. Are you sure you want to proceed?
              {restoreFile && (
                <span className="block mt-2 font-mono text-sm">File: {restoreFile.name}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => restoreFile && restoreBackup.mutate(restoreFile)}
            >
              {restoreBackup.isPending ? "Restoring..." : "Yes, Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedFile}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBackup.mutate(selectedFile)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

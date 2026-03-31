import { useState, useCallback } from "react";
import { db } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUpDown, Loader2, Plus, Minus, Equal, GitCompare } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CompareResult {
  table: string;
  currentCount: number;
  backupCount: number;
  diff: number;
}

export function BackupCompareDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [backupFileName, setBackupFileName] = useState("");

  const parseBackupFile = useCallback(async (file: File): Promise<Record<string, any[]>> => {
    const text = await file.text();
    if (file.name.endsWith(".sql")) {
      const insertRegex = /INSERT INTO public\."(\w+)"/gi;
      const counts: Record<string, any[]> = {};
      let match;
      while ((match = insertRegex.exec(text)) !== null) {
        const table = match[1];
        if (!counts[table]) counts[table] = [];
        counts[table].push({});
      }
      return counts;
    } else {
      const parsed = JSON.parse(text);
      return parsed.tables || {};
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setLoading(true);
    setOpen(true);
    setBackupFileName(file.name);
    setResults([]);

    try {
      // Parse backup file
      const backupTables = await parseBackupFile(file);

      // Get current DB counts
      const { data, error } = await db.functions.invoke("backup-restore", {
        body: { action: "compare" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const currentCounts: Record<string, number> = data.counts;

      // Build comparison
      const allTables = new Set([...Object.keys(currentCounts), ...Object.keys(backupTables)]);
      const compareResults: CompareResult[] = Array.from(allTables)
        .map((table) => {
          const currentCount = currentCounts[table] ?? 0;
          const backupCount = backupTables[table]?.length ?? 0;
          return {
            table,
            currentCount,
            backupCount,
            diff: backupCount - currentCount,
          };
        })
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

      setResults(compareResults);
    } catch (err: any) {
      toast({ title: "Comparison Failed", description: err.message, variant: "destructive" });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [parseBackupFile, toast]);

  const totalCurrent = results.reduce((s, r) => s + r.currentCount, 0);
  const totalBackup = results.reduce((s, r) => s + r.backupCount, 0);
  const tablesChanged = results.filter((r) => r.diff !== 0).length;

  return (
    <>
      <label>
        <input
          type="file"
          accept=".json,.sql"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button variant="outline" className="w-full" asChild>
          <span>
            <GitCompare className="h-4 w-4 mr-2" /> Compare Backup
          </span>
        </Button>
      </label>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              Backup Comparison
            </DialogTitle>
            <DialogDescription>
              Comparing <span className="font-mono text-xs">{backupFileName}</span> against current database
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing differences...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">Current DB</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold text-foreground">{totalCurrent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">total rows</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">Backup File</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold text-foreground">{totalBackup.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">total rows</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">Tables Changed</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold text-foreground">{tablesChanged}</p>
                    <p className="text-xs text-muted-foreground">of {results.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Table Comparison */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Backup</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.table} className={r.diff !== 0 ? "bg-muted/30" : ""}>
                      <TableCell className="font-mono text-sm">{r.table}</TableCell>
                      <TableCell className="text-right">{r.currentCount}</TableCell>
                      <TableCell className="text-right">{r.backupCount}</TableCell>
                      <TableCell className="text-right">
                        {r.diff === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={r.diff > 0 ? "text-green-600" : "text-destructive"}>
                            {r.diff > 0 ? `+${r.diff}` : r.diff}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.diff === 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Equal className="h-3 w-3" /> No change
                          </Badge>
                        ) : r.diff > 0 ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <Plus className="h-3 w-3" /> +{r.diff} rows
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <Minus className="h-3 w-3" /> {Math.abs(r.diff)} rows removed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Visual bar */}
              {totalBackup > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Backup coverage: {Math.round((totalBackup / Math.max(totalCurrent, 1)) * 100)}% of current data
                  </p>
                  <Progress value={Math.min((totalBackup / Math.max(totalCurrent, 1)) * 100, 100)} className="h-2" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

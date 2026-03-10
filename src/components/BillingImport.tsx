import { useState, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, Download, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useFileDrop } from "@/hooks/useFileDrop";

interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface ParsedRow {
  rowNum: number;
  customer_id: string;
  month: string;
  amount: string;
  due_date: string;
  status: string;
  issues: ValidationIssue[];
}

interface ImportError {
  row: number;
  customer_id: string;
  reason: string;
  data?: Record<string, any>;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: ImportError[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const HEADER_MAP: Record<string, string> = {
  customer_id: "customer_id", customerid: "customer_id", "customer id": "customer_id",
  month: "month", billing_month: "month", "billing month": "month",
  amount: "amount", bill_amount: "amount", "bill amount": "amount",
  due_date: "due_date", duedate: "due_date", "due date": "due_date",
  status: "status",
};

function normalizeHeader(h: string): string {
  const s = h.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  return HEADER_MAP[s] || s;
}

function downloadTemplate() {
  const headers = ["Customer ID", "Month", "Amount", "Due Date", "Status"];
  const sample = ["ISP-00001", "2026-03", "800", "2026-03-15", "unpaid"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bills");
  XLSX.writeFile(wb, "billing-import-template.xlsx");
}

type Step = "upload" | "preview" | "result";

export default function BillingImport({ open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Unsupported file format. Use .xlsx, .xls, or .csv");
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!rows.length) {
        toast.error("The file is empty or has no data rows");
        return;
      }

      setRawRows(rows);

      // Client-side validation preview
      const parsed: ParsedRow[] = rows.map((raw, i) => {
        const n: Record<string, any> = {};
        Object.entries(raw).forEach(([key, val]) => { n[normalizeHeader(key)] = val; });
        const rowNum = i + 2;
        const issues: ValidationIssue[] = [];

        const custId = String(n.customer_id || "").trim();
        const month = String(n.month || "").trim();
        const amount = String(n.amount || "").trim();
        const status = String(n.status || "unpaid").trim().toLowerCase();

        if (!custId) issues.push({ row: rowNum, field: "customer_id", message: "Customer ID is required", severity: "error" });
        if (!month) {
          issues.push({ row: rowNum, field: "month", message: "Month is required", severity: "error" });
        } else if (!/^\d{4}-\d{2}$/.test(month)) {
          issues.push({ row: rowNum, field: "month", message: "Must be YYYY-MM format", severity: "error" });
        }
        if (amount && isNaN(parseFloat(amount))) {
          issues.push({ row: rowNum, field: "amount", message: "Invalid number", severity: "error" });
        }
        if (!amount) {
          issues.push({ row: rowNum, field: "amount", message: "Will use customer's monthly bill", severity: "warning" });
        }
        if (status && !["unpaid", "paid", "partial"].includes(status)) {
          issues.push({ row: rowNum, field: "status", message: `Invalid status "${status}"`, severity: "warning" });
        }

        return { rowNum, customer_id: custId, month, amount, due_date: String(n.due_date || ""), status, issues };
      });

      setParsedRows(parsed);
      setStep("preview");
    } catch (err: any) {
      toast.error(`Failed to parse file: ${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(processFile);

  const { errorCount, warningCount, validCount } = useMemo(() => {
    let errors = 0, warnings = 0, valid = 0;
    parsedRows.forEach(r => {
      const hasError = r.issues.some(i => i.severity === "error");
      if (hasError) errors++;
      else if (r.issues.some(i => i.severity === "warning")) { warnings++; valid++; }
      else valid++;
    });
    return { errorCount: errors, warningCount: warnings, validCount: valid };
  }, [parsedRows]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, customer_id, monthly_bill, due_date_day")
        .eq("status", "active");
      const custMap = new Map(customers?.map((c) => [c.customer_id.toUpperCase(), c]) || []);

      const errors: ImportError[] = [];
      let imported = 0;
      let duplicates = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];
        const rowNum = i + 2;
        const n: Record<string, any> = {};
        Object.entries(raw).forEach(([key, val]) => { n[normalizeHeader(key)] = val; });

        const custId = String(n.customer_id || "").trim().toUpperCase();
        const month = String(n.month || "").trim();
        const amount = parseFloat(n.amount);
        const status = String(n.status || "unpaid").trim().toLowerCase();

        if (!custId) { errors.push({ row: rowNum, customer_id: "—", reason: "Missing Customer ID", data: n }); continue; }
        if (!month || !/^\d{4}-\d{2}$/.test(month)) { errors.push({ row: rowNum, customer_id: custId, reason: "Invalid Month format (use YYYY-MM)", data: n }); continue; }

        const cust = custMap.get(custId);
        if (!cust) { errors.push({ row: rowNum, customer_id: custId, reason: "Customer not found or inactive", data: n }); continue; }

        const billAmount = isNaN(amount) ? cust.monthly_bill : amount;

        let dueDateStr: string | null = null;
        if (n.due_date) {
          const d = n.due_date instanceof Date ? n.due_date : new Date(n.due_date);
          if (!isNaN(d.getTime())) dueDateStr = d.toISOString().split("T")[0];
        }
        if (!dueDateStr) {
          const dueDay = cust.due_date_day || 15;
          const md = new Date(month + "-01");
          dueDateStr = new Date(md.getFullYear(), md.getMonth(), dueDay).toISOString().split("T")[0];
        }

        const { data: existing } = await supabase
          .from("bills").select("id").eq("customer_id", cust.id).eq("month", month).limit(1);
        if (existing && existing.length > 0) {
          duplicates++;
          errors.push({ row: rowNum, customer_id: custId, reason: "Bill already exists for " + month, data: n });
          continue;
        }

        const { error } = await supabase.from("bills").insert({
          customer_id: cust.id, month, amount: billAmount, due_date: dueDateStr,
          status: ["unpaid", "paid", "partial"].includes(status) ? status : "unpaid",
          ...(status === "paid" ? { paid_date: new Date().toISOString() } : {}),
        });

        if (error) { errors.push({ row: rowNum, customer_id: custId, reason: error.message, data: n }); }
        else { imported++; }
      }

      setResult({ total: rawRows.length, imported, duplicates, errors });
      setStep("result");
      if (imported > 0) { toast.success(`${imported} bills imported successfully`); onComplete(); }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;
    const wsData: any[][] = [
      ["Row", "Customer ID", "Reason", "Month", "Amount"],
      ...result.errors.map((e) => [e.row, e.customer_id, e.reason, e.data?.month || "", e.data?.amount || ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "billing-import-errors.xlsx");
  };

  const handleClose = (o: boolean) => {
    if (!o) { setResult(null); setImporting(false); setStep("upload"); setParsedRows([]); setRawRows([]); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Excel — Bulk Bill Import</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === "upload" && (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              >
                <Upload className={`h-8 w-8 mx-auto mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm text-muted-foreground mb-3">{isDragging ? "Drop file here..." : "Drag & drop or select an Excel/CSV file"}</p>
                <p className="text-xs font-mono text-muted-foreground mb-4">Customer ID | Month | Amount | Due Date | Status</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Select File</Button>
                  <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Template</Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Required: <strong>Customer ID, Month</strong> (YYYY-MM format)</p>
                <p>• If Amount is empty, the customer's monthly bill is used</p>
                <p>• Duplicate bills (same customer + month) are skipped</p>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-muted/50"><Eye className="h-3 w-3 mr-1" />{parsedRows.length} rows</Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />{validCount} valid</Badge>
                {errorCount > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />{errorCount} errors</Badge>}
                {warningCount > 0 && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertTriangle className="h-3 w-3 mr-1" />{warningCount} warnings</Badge>}
              </div>

              <div className="max-h-52 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border bg-muted/30 sticky top-0">
                    <th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">Customer ID</th>
                    <th className="py-1.5 px-2 text-left">Month</th><th className="py-1.5 px-2 text-left">Amount</th>
                    <th className="py-1.5 px-2 text-left">Status</th>
                  </tr></thead>
                  <tbody>
                    {parsedRows.map((r) => {
                      const hasError = r.issues.some(i => i.severity === "error");
                      const hasWarning = r.issues.some(i => i.severity === "warning");
                      return (
                        <tr key={r.rowNum} className={`border-b border-border/50 ${hasError ? "bg-destructive/5" : hasWarning ? "bg-yellow-500/5" : ""}`}>
                          <td className="py-1 px-2">{r.rowNum}</td>
                          <td className="py-1 px-2 font-mono">{r.customer_id || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.month || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.amount || <span className="text-muted-foreground italic">auto</span>}</td>
                          <td className="py-1 px-2">{r.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {parsedRows.some(r => r.issues.length > 0) && (
                <div className="max-h-28 overflow-y-auto border border-border rounded-lg bg-muted/20 p-2 space-y-1">
                  {parsedRows.flatMap(r => r.issues).slice(0, 15).map((issue, i) => (
                    <p key={i} className={`text-xs flex items-start gap-1.5 ${issue.severity === "error" ? "text-destructive" : "text-yellow-600"}`}>
                      {issue.severity === "error" ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                      <span>Row {issue.row}: {issue.message} ({issue.field})</span>
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setParsedRows([]); setRawRows([]); }}>Back</Button>
                <Button size="sm" onClick={handleImport} disabled={importing || errorCount === parsedRows.length}>
                  {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing...</> : <>Import {validCount} Bills</>}
                </Button>
              </div>
            </>
          )}

          {step === "result" && result && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center"><p className="text-2xl font-bold">{result.total}</p><p className="text-xs text-muted-foreground">Total Rows</p></div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-green-600">{result.imported}</p><p className="text-xs text-muted-foreground">Imported</p></div>
                <div className="bg-yellow-500/10 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-yellow-600">{result.duplicates}</p><p className="text-xs text-muted-foreground">Duplicates</p></div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-destructive">{result.errors.length - result.duplicates}</p><p className="text-xs text-muted-foreground">Errors</p></div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30"><th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">Customer</th><th className="py-1.5 px-2 text-left">Reason</th></tr></thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i} className="border-b border-border/50"><td className="py-1 px-2">{e.row}</td><td className="py-1 px-2 font-mono">{e.customer_id}</td><td className="py-1 px-2 text-destructive">{e.reason}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-between">
                {result.errors.length > 0 && <Button variant="outline" size="sm" onClick={downloadErrorReport}><Download className="h-4 w-4 mr-2" /> Error Report</Button>}
                <Button size="sm" className="ml-auto" onClick={() => handleClose(false)}>Done</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

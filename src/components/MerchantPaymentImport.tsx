import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, Download, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface ParsedRow {
  rowNum: number;
  date: string;
  transaction_id: string;
  sender_phone: string;
  amount: string;
  reference: string;
  issues: ValidationIssue[];
}

interface ImportError {
  row: number;
  transaction_id: string;
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

function normalizeHeader(h: string): string {
  const s = h.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (s === "trx_id" || s === "trxid" || s === "transaction_id" || s === "transactionid") return "transaction_id";
  if (s === "phone" || s === "sender_phone" || s === "senderphone") return "sender_phone";
  if (s === "date" || s === "payment_date") return "date";
  if (s === "amount") return "amount";
  if (s === "reference" || s === "ref" || s === "customer_id") return "reference";
  return s;
}

function downloadTemplate() {
  const headers = ["Date", "Transaction ID", "Sender Phone", "Amount", "Reference"];
  const sample = ["2026-03-09", "TESTPAY001", "01712345678", "800", "ISP-00001"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Merchant Payments");
  XLSX.writeFile(wb, "merchant-payment-template.xlsx");
}

type Step = "upload" | "preview" | "result";

export default function MerchantPaymentImport({ open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Unsupported file format. Use .xlsx, .xls, or .csv");
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!rawRows.length) {
        toast.error("The file is empty or has no data rows");
        return;
      }

      const parsed: ParsedRow[] = rawRows.map((raw, i) => {
        const n: Record<string, any> = {};
        Object.entries(raw).forEach(([key, val]) => { n[normalizeHeader(key)] = val; });
        const rowNum = i + 2;
        const issues: ValidationIssue[] = [];

        const transaction_id = String(n.transaction_id || "").trim();
        const sender_phone = String(n.sender_phone || "").trim();
        const amount = String(n.amount || "").trim();
        const reference = String(n.reference || "").trim();

        let dateStr = "";
        if (n.date instanceof Date) dateStr = n.date.toISOString().split("T")[0];
        else if (n.date) {
          const parsed = new Date(n.date);
          dateStr = isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
        }

        if (!transaction_id) issues.push({ row: rowNum, field: "transaction_id", message: "Transaction ID is required", severity: "error" });
        if (!sender_phone) issues.push({ row: rowNum, field: "sender_phone", message: "Sender Phone is required", severity: "error" });
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) issues.push({ row: rowNum, field: "amount", message: "Valid positive amount required", severity: "error" });
        if (!dateStr) issues.push({ row: rowNum, field: "date", message: "Invalid or missing date", severity: "warning" });
        if (!reference) issues.push({ row: rowNum, field: "reference", message: "No reference — won't auto-match", severity: "warning" });

        return { rowNum, date: dateStr, transaction_id, sender_phone, amount, reference, issues };
      });

      setParsedRows(parsed);
      setStep("preview");
    } catch (err: any) {
      toast.error(`Failed to parse file: ${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
      const errors: ImportError[] = [];
      let imported = 0;
      let duplicates = 0;

      for (const row of parsedRows) {
        if (row.issues.some(i => i.severity === "error")) {
          errors.push({ row: row.rowNum, transaction_id: row.transaction_id || "—", reason: row.issues.filter(i => i.severity === "error").map(i => i.message).join(", ") });
          continue;
        }

        const { error } = await supabase.from("merchant_payments").insert({
          transaction_id: row.transaction_id,
          sender_phone: row.sender_phone,
          amount: parseFloat(row.amount),
          reference: row.reference || null,
          payment_date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
        });

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique") || error.code === "23505") {
            duplicates++;
            errors.push({ row: row.rowNum, transaction_id: row.transaction_id, reason: "Duplicate Transaction ID" });
          } else {
            errors.push({ row: row.rowNum, transaction_id: row.transaction_id, reason: error.message });
          }
        } else {
          imported++;
        }
      }

      setResult({ total: parsedRows.length, imported, duplicates, errors });
      setStep("result");
      if (imported > 0) { toast.success(`${imported} transactions imported successfully`); onComplete(); }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;
    const wsData: any[][] = [
      ["Row", "Transaction ID", "Reason"],
      ...result.errors.map((e) => [e.row, e.transaction_id, e.reason]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "merchant-payment-import-errors.xlsx");
  };

  const handleClose = (o: boolean) => {
    if (!o) { setResult(null); setImporting(false); setStep("upload"); setParsedRows([]); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Excel — Merchant Payments</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === "upload" && (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Upload an Excel file (.xlsx, .xls) or CSV with columns:</p>
                <p className="text-xs font-mono text-muted-foreground mb-4">Date | Transaction ID | Sender Phone | Amount | Reference</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Select File</Button>
                  <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Template</Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Duplicates (same Transaction ID) will be skipped</p>
                <p>• If Reference matches a Customer ID, auto-matching will apply</p>
                <p>• Download the template for the correct format</p>
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
                    <th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">TrxID</th>
                    <th className="py-1.5 px-2 text-left">Phone</th><th className="py-1.5 px-2 text-left">Amount</th>
                    <th className="py-1.5 px-2 text-left">Ref</th>
                  </tr></thead>
                  <tbody>
                    {parsedRows.map((r) => {
                      const hasError = r.issues.some(i => i.severity === "error");
                      const hasWarning = r.issues.some(i => i.severity === "warning");
                      return (
                        <tr key={r.rowNum} className={`border-b border-border/50 ${hasError ? "bg-destructive/5" : hasWarning ? "bg-yellow-500/5" : ""}`}>
                          <td className="py-1 px-2">{r.rowNum}</td>
                          <td className="py-1 px-2 font-mono">{r.transaction_id || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.sender_phone || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.amount || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.reference || <span className="text-muted-foreground italic">none</span>}</td>
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
                <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setParsedRows([]); }}>Back</Button>
                <Button size="sm" onClick={handleImport} disabled={importing || errorCount === parsedRows.length}>
                  {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing...</> : <>Import {validCount} Payments</>}
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
                    <thead><tr className="border-b border-border bg-muted/30"><th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">TrxID</th><th className="py-1.5 px-2 text-left">Reason</th></tr></thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i} className="border-b border-border/50"><td className="py-1 px-2">{e.row}</td><td className="py-1 px-2 font-mono">{e.transaction_id}</td><td className="py-1 px-2 text-destructive">{e.reason}</td></tr>
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

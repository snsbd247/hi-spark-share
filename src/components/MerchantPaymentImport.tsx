import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, Download, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportRow {
  date: string;
  transaction_id: string;
  sender_phone: string;
  amount: number;
  reference: string;
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

export default function MerchantPaymentImport({ open, onOpenChange, onComplete }: Props) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Unsupported file format. Please use .xlsx, .xls, or .csv");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!rawRows.length) {
        toast.error("The file is empty or has no data rows");
        setImporting(false);
        return;
      }

      // Normalize headers
      const rows: ImportRow[] = rawRows.map((raw) => {
        const normalized: Record<string, any> = {};
        Object.entries(raw).forEach(([key, val]) => {
          normalized[normalizeHeader(key)] = val;
        });

        let dateStr = "";
        if (normalized.date instanceof Date) {
          dateStr = normalized.date.toISOString();
        } else if (normalized.date) {
          const parsed = new Date(normalized.date);
          dateStr = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        } else {
          dateStr = new Date().toISOString();
        }

        return {
          date: dateStr,
          transaction_id: String(normalized.transaction_id || "").trim(),
          sender_phone: String(normalized.sender_phone || "").trim(),
          amount: parseFloat(normalized.amount) || 0,
          reference: String(normalized.reference || "").trim(),
        };
      });

      // Process rows
      const errors: ImportError[] = [];
      let imported = 0;
      let duplicates = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // header is row 1

        // Validate required fields
        if (!row.transaction_id) {
          errors.push({ row: rowNum, transaction_id: row.transaction_id || "—", reason: "Missing Transaction ID", data: row });
          continue;
        }
        if (!row.sender_phone) {
          errors.push({ row: rowNum, transaction_id: row.transaction_id, reason: "Missing Sender Phone", data: row });
          continue;
        }
        if (!row.amount || row.amount <= 0) {
          errors.push({ row: rowNum, transaction_id: row.transaction_id, reason: "Invalid or missing Amount", data: row });
          continue;
        }

        // Insert — the auto_match_merchant_payment trigger handles matching
        const { error } = await supabase.from("merchant_payments").insert({
          transaction_id: row.transaction_id,
          sender_phone: row.sender_phone,
          amount: row.amount,
          reference: row.reference || null,
          payment_date: row.date,
        });

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique") || error.code === "23505") {
            duplicates++;
            errors.push({ row: rowNum, transaction_id: row.transaction_id, reason: "Duplicate Transaction ID", data: row });
          } else {
            errors.push({ row: rowNum, transaction_id: row.transaction_id, reason: error.message, data: row });
          }
        } else {
          imported++;
        }
      }

      setResult({ total: rows.length, imported, duplicates, errors });
      if (imported > 0) {
        toast.success(`${imported} transactions imported successfully`);
        onComplete();
      }
    } catch (err: any) {
      toast.error(`Failed to parse file: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;
    const wsData = [
      ["Row", "Transaction ID", "Reason", "Date", "Phone", "Amount", "Reference"],
      ...result.errors.map((e) => [
        e.row, e.transaction_id, e.reason,
        e.data?.date || "", e.data?.sender_phone || "", e.data?.amount || "", e.data?.reference || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "import-errors.xlsx");
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setResult(null);
      setImporting(false);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Excel — Merchant Payments</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!result ? (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an Excel file (.xlsx, .xls) or CSV with columns:
                </p>
                <p className="text-xs font-mono text-muted-foreground mb-4">
                  Date | Transaction ID | Sender Phone | Amount | Reference
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={importing}
                />
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => fileRef.current?.click()} disabled={importing}>
                    {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : <><Upload className="h-4 w-4 mr-2" /> Select File</>}
                  </Button>
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" /> Template
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Duplicates (same Transaction ID) will be skipped automatically</p>
                <p>• If Reference matches a Customer ID, auto-matching will apply</p>
                <p>• An error report can be downloaded after import</p>
                <p>• Download the template for the correct format</p>
              </div>
            </>
          ) : (
            <>
              {/* Import Result Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-success">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="bg-warning/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-warning">{result.duplicates}</p>
                  <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{result.errors.length - result.duplicates}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {result.imported > 0 && <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />{result.imported} imported</Badge>}
                {result.duplicates > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><AlertTriangle className="h-3 w-3 mr-1" />{result.duplicates} duplicates</Badge>}
                {result.errors.length - result.duplicates > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />{result.errors.length - result.duplicates} errors</Badge>}
              </div>

              {/* Error list preview */}
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30"><th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">TrxID</th><th className="py-1.5 px-2 text-left">Reason</th></tr></thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i} className="border-b border-border/50"><td className="py-1 px-2">{e.row}</td><td className="py-1 px-2 font-mono">{e.transaction_id}</td><td className="py-1 px-2 text-destructive">{e.reason}</td></tr>
                      ))}
                      {result.errors.length > 20 && <tr><td colSpan={3} className="py-1 px-2 text-muted-foreground text-center">... and {result.errors.length - 20} more</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between">
                {result.errors.length > 0 && (
                  <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                    <Download className="h-4 w-4 mr-2" /> Download Error Report
                  </Button>
                )}
                <Button size="sm" className="ml-auto" onClick={() => handleClose(false)}>Done</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

export default function BillingImport({ open, onOpenChange, onComplete }: Props) {
  const [importing, setImporting] = useState(false);
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

      // Fetch all active customers for lookup
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

        // Due date
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

        // Duplicate check
        const { data: existing } = await supabase
          .from("bills")
          .select("id")
          .eq("customer_id", cust.id)
          .eq("month", month)
          .limit(1);
        if (existing && existing.length > 0) {
          duplicates++;
          errors.push({ row: rowNum, customer_id: custId, reason: "Bill already exists for " + month, data: n });
          continue;
        }

        const { error } = await supabase.from("bills").insert({
          customer_id: cust.id,
          month,
          amount: billAmount,
          due_date: dueDateStr,
          status: ["unpaid", "paid", "partial"].includes(status) ? status : "unpaid",
          ...(status === "paid" ? { paid_date: new Date().toISOString() } : {}),
        });

        if (error) {
          errors.push({ row: rowNum, customer_id: custId, reason: error.message, data: n });
        } else {
          imported++;
        }
      }

      setResult({ total: rawRows.length, imported, duplicates, errors });
      if (imported > 0) {
        toast.success(`${imported} bills imported successfully`);
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
    const wsData: any[][] = [
      ["Row", "Customer ID", "Reason", "Month", "Amount"],
      ...result.errors.map((e) => [
        e.row, e.customer_id, e.reason, e.data?.month || "", e.data?.amount || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "billing-import-errors.xlsx");
  };

  const handleClose = (o: boolean) => {
    if (!o) { setResult(null); setImporting(false); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Excel — Bulk Bill Import</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!result ? (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an Excel file (.xlsx, .xls) or CSV to create bills
                </p>
                <p className="text-xs font-mono text-muted-foreground mb-4">
                  Customer ID | Month | Amount | Due Date | Status
                </p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} disabled={importing} />
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
                <p>• Required: <strong>Customer ID, Month</strong> (YYYY-MM format)</p>
                <p>• If Amount is empty, the customer's monthly bill is used</p>
                <p>• Duplicate bills (same customer + month) are skipped</p>
                <p>• Download the template for the correct format</p>
              </div>
            </>
          ) : (
            <>
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

              <div className="flex items-center gap-2 flex-wrap">
                {result.imported > 0 && <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />{result.imported} imported</Badge>}
                {result.duplicates > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><AlertTriangle className="h-3 w-3 mr-1" />{result.duplicates} duplicates</Badge>}
                {result.errors.length - result.duplicates > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />{result.errors.length - result.duplicates} errors</Badge>}
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30"><th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">Customer</th><th className="py-1.5 px-2 text-left">Reason</th></tr></thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i} className="border-b border-border/50"><td className="py-1 px-2">{e.row}</td><td className="py-1 px-2 font-mono">{e.customer_id}</td><td className="py-1 px-2 text-destructive">{e.reason}</td></tr>
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

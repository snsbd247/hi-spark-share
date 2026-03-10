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
  name: string;
  phone: string;
  area: string;
  monthly_bill: string;
  email: string;
  status: string;
  issues: ValidationIssue[];
  raw: Record<string, any>;
}

interface ImportError {
  row: number;
  name: string;
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
  name: "name", customer_name: "name", "customer name": "name",
  phone: "phone", mobile: "phone", "phone number": "phone", phone_number: "phone",
  area: "area", zone: "area", location: "area",
  monthly_bill: "monthly_bill", "monthly bill": "monthly_bill", bill: "monthly_bill", amount: "monthly_bill",
  email: "email", e_mail: "email",
  nid: "nid", national_id: "nid", "national id": "nid",
  father_name: "father_name", "father name": "father_name", father: "father_name",
  mother_name: "mother_name", "mother name": "mother_name", mother: "mother_name",
  alt_phone: "alt_phone", "alt phone": "alt_phone", alternative_phone: "alt_phone",
  road: "road", street: "road",
  house: "house", house_no: "house",
  city: "city", town: "city",
  ip_address: "ip_address", "ip address": "ip_address", ip: "ip_address",
  pppoe_username: "pppoe_username", "pppoe username": "pppoe_username",
  pppoe_password: "pppoe_password", "pppoe password": "pppoe_password",
  onu_mac: "onu_mac", "onu mac": "onu_mac", mac: "onu_mac",
  status: "status",
};

function normalizeHeader(h: string): string {
  const s = h.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  return HEADER_MAP[s] || s;
}

function downloadTemplate() {
  const headers = ["Name", "Phone", "Area", "Monthly Bill", "Email", "NID", "Father Name", "Mother Name", "Alt Phone", "Road", "House", "City", "IP Address", "PPPoE Username", "PPPoE Password", "ONU MAC", "Status"];
  const sample = ["John Doe", "01712345678", "Mirpur", "800", "john@email.com", "1234567890", "Father Name", "Mother Name", "01798765432", "Road 5", "House 10", "Dhaka", "192.168.1.100", "john_pppoe", "pass123", "AA:BB:CC:DD:EE:FF", "active"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, "customer-import-template.xlsx");
}

type Step = "upload" | "preview" | "result";

export default function CustomerImport({ open, onOpenChange, onComplete }: Props) {
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
      const workbook = XLSX.read(data, { type: "array" });
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

        const name = String(n.name || "").trim();
        const phone = String(n.phone || "").trim();
        const area = String(n.area || "").trim();
        const monthly_bill = String(n.monthly_bill || "").trim();
        const email = String(n.email || "").trim();
        const status = String(n.status || "active").trim().toLowerCase();

        if (!name) issues.push({ row: rowNum, field: "name", message: "Name is required", severity: "error" });
        if (!phone) issues.push({ row: rowNum, field: "phone", message: "Phone is required", severity: "error" });
        else if (phone.length < 6) issues.push({ row: rowNum, field: "phone", message: "Phone number too short", severity: "error" });
        if (!area) issues.push({ row: rowNum, field: "area", message: "Area is required", severity: "error" });
        if (monthly_bill && isNaN(parseFloat(monthly_bill))) issues.push({ row: rowNum, field: "monthly_bill", message: "Invalid bill amount", severity: "error" });
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ row: rowNum, field: "email", message: "Invalid email format", severity: "warning" });
        if (!["active", "inactive", "suspended"].includes(status)) issues.push({ row: rowNum, field: "status", message: `Unknown status "${status}"`, severity: "warning" });

        return { rowNum, name, phone, area, monthly_bill, email, status, issues, raw: n };
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
          errors.push({ row: row.rowNum, name: row.name || "—", reason: row.issues.filter(i => i.severity === "error").map(i => i.message).join(", "), data: row.raw });
          continue;
        }

        const { data: existing } = await supabase.from("customers").select("id").eq("phone", row.phone).limit(1);
        if (existing && existing.length > 0) {
          duplicates++;
          errors.push({ row: row.rowNum, name: row.name, reason: "Duplicate Phone: " + row.phone, data: row.raw });
          continue;
        }

        const insertData: Record<string, any> = {
          name: row.name, phone: row.phone, area: row.area,
          monthly_bill: parseFloat(row.monthly_bill) || 0,
          status: row.status || "active",
          customer_id: "TEMP",
        };
        const n = row.raw;
        if (n.email) insertData.email = String(n.email).trim();
        if (n.nid) insertData.nid = String(n.nid).trim();
        if (n.father_name) insertData.father_name = String(n.father_name).trim();
        if (n.mother_name) insertData.mother_name = String(n.mother_name).trim();
        if (n.alt_phone) insertData.alt_phone = String(n.alt_phone).trim();
        if (n.road) insertData.road = String(n.road).trim();
        if (n.house) insertData.house = String(n.house).trim();
        if (n.city) insertData.city = String(n.city).trim();
        if (n.ip_address) insertData.ip_address = String(n.ip_address).trim();
        if (n.pppoe_username) insertData.pppoe_username = String(n.pppoe_username).trim();
        if (n.pppoe_password) insertData.pppoe_password = String(n.pppoe_password).trim();
        if (n.onu_mac) insertData.onu_mac = String(n.onu_mac).trim();

        const { error } = await supabase.from("customers").insert(insertData as any);
        if (error) { errors.push({ row: row.rowNum, name: row.name, reason: error.message, data: row.raw }); }
        else { imported++; }
      }

      setResult({ total: parsedRows.length, imported, duplicates, errors });
      setStep("result");
      if (imported > 0) { toast.success(`${imported} customers imported successfully`); onComplete(); }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;
    const wsData: any[][] = [
      ["Row", "Name", "Reason", "Phone", "Area", "Monthly Bill"],
      ...result.errors.map((e) => [e.row, e.name, e.reason, e.data?.phone || "", e.data?.area || "", e.data?.monthly_bill || ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "customer-import-errors.xlsx");
  };

  const handleClose = (o: boolean) => {
    if (!o) { setResult(null); setImporting(false); setStep("upload"); setParsedRows([]); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Excel — Bulk Customer Import</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === "upload" && (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Upload an Excel file (.xlsx, .xls) or CSV with customer data</p>
                <p className="text-xs font-mono text-muted-foreground mb-4">Name | Phone | Area | Monthly Bill | ...</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Select File</Button>
                  <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Template</Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Required columns: <strong>Name, Phone, Area</strong></p>
                <p>• Duplicates (same phone) will be skipped</p>
                <p>• Customer IDs are auto-generated</p>
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
                    <th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">Name</th>
                    <th className="py-1.5 px-2 text-left">Phone</th><th className="py-1.5 px-2 text-left">Area</th>
                    <th className="py-1.5 px-2 text-left">Bill</th>
                  </tr></thead>
                  <tbody>
                    {parsedRows.map((r) => {
                      const hasError = r.issues.some(i => i.severity === "error");
                      const hasWarning = r.issues.some(i => i.severity === "warning");
                      return (
                        <tr key={r.rowNum} className={`border-b border-border/50 ${hasError ? "bg-destructive/5" : hasWarning ? "bg-yellow-500/5" : ""}`}>
                          <td className="py-1 px-2">{r.rowNum}</td>
                          <td className="py-1 px-2">{r.name || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2 font-mono">{r.phone || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.area || <span className="text-destructive italic">missing</span>}</td>
                          <td className="py-1 px-2">{r.monthly_bill || "0"}</td>
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
                  {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing...</> : <>Import {validCount} Customers</>}
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
                    <thead><tr className="border-b border-border bg-muted/30"><th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">Name</th><th className="py-1.5 px-2 text-left">Reason</th></tr></thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i} className="border-b border-border/50"><td className="py-1 px-2">{e.row}</td><td className="py-1 px-2">{e.name}</td><td className="py-1 px-2 text-destructive">{e.reason}</td></tr>
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

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
  name: string;
  phone: string;
  area: string;
  monthly_bill: number;
  email?: string;
  nid?: string;
  father_name?: string;
  mother_name?: string;
  alt_phone?: string;
  road?: string;
  house?: string;
  city?: string;
  ip_address?: string;
  pppoe_username?: string;
  pppoe_password?: string;
  onu_mac?: string;
  status?: string;
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

export default function CustomerImport({ open, onOpenChange, onComplete }: Props) {
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
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!rawRows.length) {
        toast.error("The file is empty or has no data rows");
        setImporting(false);
        return;
      }

      const rows: ImportRow[] = rawRows.map((raw) => {
        const n: Record<string, any> = {};
        Object.entries(raw).forEach(([key, val]) => { n[normalizeHeader(key)] = val; });
        return {
          name: String(n.name || "").trim(),
          phone: String(n.phone || "").trim(),
          area: String(n.area || "").trim(),
          monthly_bill: parseFloat(n.monthly_bill) || 0,
          email: n.email ? String(n.email).trim() : undefined,
          nid: n.nid ? String(n.nid).trim() : undefined,
          father_name: n.father_name ? String(n.father_name).trim() : undefined,
          mother_name: n.mother_name ? String(n.mother_name).trim() : undefined,
          alt_phone: n.alt_phone ? String(n.alt_phone).trim() : undefined,
          road: n.road ? String(n.road).trim() : undefined,
          house: n.house ? String(n.house).trim() : undefined,
          city: n.city ? String(n.city).trim() : undefined,
          ip_address: n.ip_address ? String(n.ip_address).trim() : undefined,
          pppoe_username: n.pppoe_username ? String(n.pppoe_username).trim() : undefined,
          pppoe_password: n.pppoe_password ? String(n.pppoe_password).trim() : undefined,
          onu_mac: n.onu_mac ? String(n.onu_mac).trim() : undefined,
          status: n.status ? String(n.status).trim().toLowerCase() : "active",
        };
      });

      const errors: ImportError[] = [];
      let imported = 0;
      let duplicates = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        if (!row.name) { errors.push({ row: rowNum, name: "—", reason: "Missing Name", data: row }); continue; }
        if (!row.phone) { errors.push({ row: rowNum, name: row.name, reason: "Missing Phone", data: row }); continue; }
        if (!row.area) { errors.push({ row: rowNum, name: row.name, reason: "Missing Area", data: row }); continue; }

        // Check duplicate by phone
        const { data: existing } = await supabase.from("customers").select("id").eq("phone", row.phone).limit(1);
        if (existing && existing.length > 0) {
          duplicates++;
          errors.push({ row: rowNum, name: row.name, reason: "Duplicate Phone: " + row.phone, data: row });
          continue;
        }

        const insertData: Record<string, any> = {
          name: row.name,
          phone: row.phone,
          area: row.area,
          monthly_bill: row.monthly_bill,
          status: row.status || "active",
          customer_id: "TEMP", // trigger will generate
        };
        if (row.email) insertData.email = row.email;
        if (row.nid) insertData.nid = row.nid;
        if (row.father_name) insertData.father_name = row.father_name;
        if (row.mother_name) insertData.mother_name = row.mother_name;
        if (row.alt_phone) insertData.alt_phone = row.alt_phone;
        if (row.road) insertData.road = row.road;
        if (row.house) insertData.house = row.house;
        if (row.city) insertData.city = row.city;
        if (row.ip_address) insertData.ip_address = row.ip_address;
        if (row.pppoe_username) insertData.pppoe_username = row.pppoe_username;
        if (row.pppoe_password) insertData.pppoe_password = row.pppoe_password;
        if (row.onu_mac) insertData.onu_mac = row.onu_mac;

        const { error } = await supabase.from("customers").insert(insertData as any);
        if (error) {
          errors.push({ row: rowNum, name: row.name, reason: error.message, data: row });
        } else {
          imported++;
        }
      }

      setResult({ total: rows.length, imported, duplicates, errors });
      if (imported > 0) {
        toast.success(`${imported} customers imported successfully`);
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
      ["Row", "Name", "Reason", "Phone", "Area", "Monthly Bill"],
      ...result.errors.map((e) => [
        e.row, e.name, e.reason,
        e.data?.phone || "", e.data?.area || "", e.data?.monthly_bill || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "customer-import-errors.xlsx");
  };

  const handleClose = (o: boolean) => {
    if (!o) { setResult(null); setImporting(false); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Excel — Bulk Customer Import</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!result ? (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an Excel file (.xlsx, .xls) or CSV with customer data
                </p>
                <p className="text-xs font-mono text-muted-foreground mb-4">
                  Name | Phone | Area | Monthly Bill | ...
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
                <p>• Required columns: <strong>Name, Phone, Area</strong></p>
                <p>• Duplicates (same phone) will be skipped</p>
                <p>• Customer IDs are auto-generated</p>
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
                    <thead><tr className="border-b border-border bg-muted/30"><th className="py-1.5 px-2 text-left">Row</th><th className="py-1.5 px-2 text-left">Name</th><th className="py-1.5 px-2 text-left">Reason</th></tr></thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i} className="border-b border-border/50"><td className="py-1 px-2">{e.row}</td><td className="py-1 px-2">{e.name}</td><td className="py-1 px-2 text-destructive">{e.reason}</td></tr>
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

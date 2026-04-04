import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { db } from "@/integrations/supabase/client";
import { Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import * as XLSX from "xlsx";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

export default function BtrcReport() {
  const { t } = useLanguage();
  const { branding } = useBranding();
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const tableRef = useRef<HTMLDivElement>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-btrc", tenantId],
    queryFn: async () => {
      let q: any = (db as any).from("customers").select("*");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["packages-btrc"],
    queryFn: async () => {
      const { data } = await ( db as any).from("packages").select("*");
      return data || [];
    },
  });

  const getPackage = (pkgId: string | null) =>
    packages.find((p: any) => p.id === pkgId);

  const getBandwidth = (customer: any) => {
    const pkg = getPackage(customer.package_id);
    if (pkg) return `${pkg.download_speed || pkg.speed || "N/A"}Mbps`;
    return "N/A";
  };

  const getConnectionType = () => "Wired";
  const getConnectivityType = () => "Shared";
  const getClientType = () => "Home";

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    } catch {
      return "";
    }
  };

  const operatorName = branding.site_name || "Smart ISP";

  const rows = customers.map((c: any) => ({
    name_operator: operatorName,
    type_of_client: getClientType(),
    type_of_connection: getConnectionType(),
    name_of_client: c.name,
    type_of_connectivity: getConnectivityType(),
    activation_date: formatDate(c.installation_date || c.created_at),
    bandwidth_allocation: getBandwidth(c),
    allocated_ip: c.ip_address || "",
    area: c.area || "",
    district: c.district || "",
    thana: c.city || "",
    client_phone: c.phone || "",
    mail: c.email || "",
    selling_bandwidth: c.monthly_bill || 0,
  }));

  const handlePrint = () => {
    const printContent = tableRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>BTRC Report - ${operatorName}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 10px; }
        h1 { text-align: center; font-size: 18px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 10px; }
        th { background: #e0e0e0; font-weight: bold; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h1>{t.sidebar.btrcReport}</h1>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleExportXls = () => {
    const wsData = [
      [
        "name_operator", "type_of_client", "type_of_connection", "name_of_client",
        "type_of_connectivity", "activation_date", "bandwidth_allocation_MB",
        "allocated_ip", "area", "district", "thana", "client_phone", "mail",
        "selling_bandwidthBDT (Excluding VAT).",
      ],
      ...rows.map((r: any) => [
        r.name_operator, r.type_of_client, r.type_of_connection, r.name_of_client,
        r.type_of_connectivity, r.activation_date, r.bandwidth_allocation,
        r.allocated_ip, r.area, r.district, r.thana, r.client_phone, r.mail,
        r.selling_bandwidth,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.sidebar.btrcReport);
    XLSX.writeFile(wb, `btrc-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t.sidebar.btrcReport}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportXls}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            XLS
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-primary">{customers.length}</div>
          <p className="text-sm text-muted-foreground">Total Subscribers</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-success">
            {customers.filter((c: any) => c.status === "active").length}
          </div>
          <p className="text-sm text-muted-foreground">Active Subscribers</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-destructive">
            {customers.filter((c: any) => c.status !== "active").length}
          </div>
          <p className="text-sm text-muted-foreground">Inactive Subscribers</p>
        </div>
      </div>

      {/* BTRC Table */}
      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto" ref={tableRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">name_operator</TableHead>
                  <TableHead className="whitespace-nowrap">type_of_client</TableHead>
                  <TableHead className="whitespace-nowrap">type_of_connection</TableHead>
                  <TableHead className="whitespace-nowrap">name_of_client</TableHead>
                  <TableHead className="whitespace-nowrap">type_of_connectivity</TableHead>
                  <TableHead className="whitespace-nowrap">activation_date</TableHead>
                  <TableHead className="whitespace-nowrap">bandwidth_allocation MB</TableHead>
                  <TableHead className="whitespace-nowrap">allocated_ip</TableHead>
                  <TableHead className="whitespace-nowrap">area</TableHead>
                  <TableHead className="whitespace-nowrap">district</TableHead>
                  <TableHead className="whitespace-nowrap">thana</TableHead>
                  <TableHead className="whitespace-nowrap">client_phone</TableHead>
                  <TableHead className="whitespace-nowrap">mail</TableHead>
                  <TableHead className="whitespace-nowrap">selling_bandwidthBDT (Excluding VAT).</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground py-12">
                      No subscriber data found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{r.name_operator}</TableCell>
                      <TableCell>{r.type_of_client}</TableCell>
                      <TableCell>{r.type_of_connection}</TableCell>
                      <TableCell className="font-medium">{r.name_of_client}</TableCell>
                      <TableCell>{r.type_of_connectivity}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.activation_date}</TableCell>
                      <TableCell>{r.bandwidth_allocation}</TableCell>
                      <TableCell>{r.allocated_ip}</TableCell>
                      <TableCell>{r.area}</TableCell>
                      <TableCell>{r.district}</TableCell>
                      <TableCell>{r.thana}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.client_phone}</TableCell>
                      <TableCell>{r.mail}</TableCell>
                      <TableCell className="text-right">{r.selling_bandwidth}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

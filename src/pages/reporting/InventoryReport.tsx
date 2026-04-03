import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle } from "lucide-react";
import ReportToolbar from "@/components/reports/ReportToolbar";
import { useLanguage } from "@/contexts/LanguageContext";

export default function InventoryReport() {
  const { t } = useLanguage();
  const r = t.reportingPages;

  const { data: products = [] } = useQuery({
    queryKey: ["inventory-report-products"],
    queryFn: async () => { const { data } = await db.from("products").select("*"); return data || []; },
  });

  const totalValue = products.reduce((s: number, p: any) => s + (Number(p.stock_quantity || 0) * Number(p.cost_price || 0)), 0);
  const lowStock = products.filter((p: any) => Number(p.stock_quantity || 0) <= Number(p.low_stock_alert || 0));
  const totalItems = products.reduce((s: number, p: any) => s + Number(p.stock_quantity || 0), 0);

  const tableData = products.map((p: any) => ({
    name: p.name,
    sku: p.sku || "",
    stock: Number(p.stock_quantity || 0),
    cost_price: Number(p.cost_price || 0),
    sale_price: Number(p.sale_price || 0),
    value: Number(p.stock_quantity || 0) * Number(p.cost_price || 0),
  }));

  const columns = [
    { header: r.product, key: "name" },
    { header: r.sku, key: "sku" },
    { header: r.stock, key: "stock" },
    { header: r.costPrice, key: "cost_price", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: r.salePrice, key: "sale_price", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: r.value, key: "value", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Package className="h-6 w-6" /> {r.inventoryReport}</h1>
          <p className="text-muted-foreground text-sm">{r.inventoryReportDesc}</p>
        </div>

        <ReportToolbar title={r.inventoryReport} data={tableData} columns={columns} showDateFilter={false} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">{r.totalProducts}</p><p className="text-2xl font-bold">{products.length}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">{r.totalStock}</p><p className="text-2xl font-bold">{totalItems}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">{r.inventoryValue}</p><p className="text-2xl font-bold text-primary">৳{totalValue.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">{r.lowStockItems}</p><p className="text-2xl font-bold text-destructive">{lowStock.length}</p></CardContent></Card>
        </div>

        {lowStock.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> {r.lowStockAlerts}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{r.product}</TableHead>
                    <TableHead>{r.sku}</TableHead>
                    <TableHead className="text-right">{r.stock}</TableHead>
                    <TableHead className="text-right">{r.alertLevel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell className="text-right text-destructive font-bold">{p.stock_quantity}</TableCell>
                      <TableCell className="text-right">{p.low_stock_alert}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">{r.allProducts}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{r.product}</TableHead>
                  <TableHead>{r.sku}</TableHead>
                  <TableHead className="text-right">{r.stock}</TableHead>
                  <TableHead className="text-right">{r.costPrice}</TableHead>
                  <TableHead className="text-right">{r.salePrice}</TableHead>
                  <TableHead className="text-right">{r.value}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell className="text-right">{p.stock_quantity}</TableCell>
                    <TableCell className="text-right">৳{Number(p.cost_price || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">৳{Number(p.sale_price || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">৳{(Number(p.stock_quantity || 0) * Number(p.cost_price || 0)).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

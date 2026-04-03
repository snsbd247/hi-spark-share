import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from "lucide-react";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function InventoryReport() {
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
    { header: "Product", key: "name" },
    { header: "SKU", key: "sku" },
    { header: "Stock", key: "stock" },
    { header: "Cost Price", key: "cost_price", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Sale Price", key: "sale_price", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Value", key: "value", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Package className="h-6 w-6" /> Inventory Report</h1>
          <p className="text-muted-foreground text-sm">Stock levels, valuation and low stock alerts</p>
        </div>

        <ReportToolbar title="Inventory Report" data={tableData} columns={columns} showDateFilter={false} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{products.length}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Stock</p><p className="text-2xl font-bold">{totalItems}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Inventory Value</p><p className="text-2xl font-bold text-primary">৳{totalValue.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Low Stock Items</p><p className="text-2xl font-bold text-destructive">{lowStock.length}</p></CardContent></Card>
        </div>

        {lowStock.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Low Stock Alerts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Alert Level</TableHead>
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
          <CardHeader><CardTitle className="text-sm">All Products</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
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

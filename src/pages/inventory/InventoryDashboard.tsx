import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, ArrowDown, ArrowUp, RotateCcw, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function InventoryDashboard() {
  const navigate = useNavigate();

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await (db as any).from("products").select("*").order("name");
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["inventory_logs_recent"],
    queryFn: async () => {
      const { data } = await (db as any).from("inventory_logs").select("*,product:products(name)").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["customer_devices_count"],
    queryFn: async () => {
      const { data } = await (db as any).from("customer_devices").select("*").eq("status", "active");
      return data || [];
    },
  });

  const totalStock = products.reduce((s: number, p: any) => s + (p.stock || 0), 0);
  const lowStock = products.filter((p: any) => p.stock <= 5 && p.status === "active");
  const outOfStock = products.filter((p: any) => p.stock === 0 && p.status === "active");
  const totalValue = products.reduce((s: number, p: any) => s + (p.stock || 0) * (p.buy_price || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of stock, devices, and inventory activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/inventory/products")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold text-foreground">{products.length}</p>
                  <p className="text-xs text-muted-foreground">Total Stock: {totalStock}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Stock Value</p>
                  <p className="text-2xl font-bold text-foreground">৳{totalValue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Based on buy price</p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/inventory/products")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock Items</p>
                  <p className="text-2xl font-bold text-destructive">{lowStock.length}</p>
                  <p className="text-xs text-muted-foreground">Out of stock: {outOfStock.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/inventory/devices")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Devices</p>
                  <p className="text-2xl font-bold text-foreground">{devices.length}</p>
                  <p className="text-xs text-muted-foreground">Assigned to customers</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStock.slice(0, 10).map((p: any) => (
                  <Badge key={p.id} variant={p.stock === 0 ? "destructive" : "secondary"}>
                    {p.name} ({p.stock})
                  </Badge>
                ))}
                {lowStock.length > 10 && (
                  <Badge variant="outline">+{lowStock.length - 10} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Inventory Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      {log.type === "in" && <ArrowDown className="h-4 w-4 text-green-600" />}
                      {log.type === "out" && <ArrowUp className="h-4 w-4 text-red-600" />}
                      {log.type === "return" && <RotateCcw className="h-4 w-4 text-blue-600" />}
                      <div>
                        <p className="text-sm font-medium text-foreground">{log.product?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{log.note || log.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.type === "in" ? "default" : log.type === "out" ? "destructive" : "secondary"}>
                        {log.type === "in" ? "+" : log.type === "out" ? "-" : "↩"}{log.quantity}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

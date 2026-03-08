import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Eye, Pencil, Printer, Search, Loader2 } from "lucide-react";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerView from "@/components/customers/CustomerView";
import { generateCustomerPDF } from "@/lib/pdf";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [viewCustomer, setViewCustomer] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, packages(name), mikrotik_routers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = customers?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.area.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/20";
      case "suspended": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const syncStatusColor = (status: string) => {
    switch (status) {
      case "synced": return "bg-success/10 text-success border-success/20";
      case "pending": return "bg-warning/10 text-warning border-warning/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your customer base</p>
        </div>
        <Button onClick={() => { setEditCustomer(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Monthly Bill</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MikroTik Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-mono text-sm">{customer.customer_id}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.area}</TableCell>
                      <TableCell>{customer.packages?.name ?? "—"}</TableCell>
                      <TableCell>৳{Number(customer.monthly_bill).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(customer.status)}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={syncStatusColor((customer as any).mikrotik_sync_status || "pending")}>
                          {(customer as any).mikrotik_sync_status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewCustomer(customer); setViewOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditCustomer(customer); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generateCustomerPDF(customer)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editCustomer}
            onSuccess={() => {
              setFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ["customers"] });
              queryClient.invalidateQueries({ queryKey: ["customers-stats"] });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {viewCustomer && <CustomerView customer={viewCustomer} />}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

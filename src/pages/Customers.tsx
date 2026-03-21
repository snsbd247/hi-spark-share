import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, Pencil, Printer, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerView from "@/components/customers/CustomerView";
import { generateCustomerPDF } from "@/lib/pdf";
import CustomerImport from "@/components/CustomerImport";
import { usePermissions } from "@/hooks/usePermissions";
import { useInvoiceFooter } from "@/hooks/useInvoiceFooter";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { data: invoiceFooter } = useInvoiceFooter();
  const canCreate = isSuperAdmin || hasPermission("customers", "create");
  const canEdit = isSuperAdmin || hasPermission("customers", "edit");

  const bulkSyncCustomers = async () => {
    setBulkSyncing(true);
    try {
      const { data } = await api.post('/mikrotik/sync-all', {});
      if (data.success) {
        const r = data.results;
        toast.success(`Bulk sync complete: ${r.synced} synced, ${r.failed} failed`);
        if (r.errors?.length > 0) toast.warning(`Errors: ${r.errors.slice(0, 3).join("; ")}`);
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      } else {
        toast.error(data.error || "Bulk sync failed");
      }
    } catch {
      toast.error("Could not connect to MikroTik");
    } finally {
      setBulkSyncing(false);
    }
  };

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

  const totalItems = filtered?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCustomers = useMemo(() => {
    if (!filtered) return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={bulkSyncCustomers} disabled={bulkSyncing}>
            {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync All to MikroTik
          </Button>
          {canCreate && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Upload Excel
              </Button>
              <Button onClick={() => { setEditCustomer(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Customer
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
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
                  {paginatedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCustomers.map((customer) => (
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/customers/${customer.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditCustomer(customer); setFormOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generateCustomerPDF(customer, invoiceFooter)}>
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

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 border-t border-border gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span>Showing {totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, totalItems)} of {totalItems}</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2 text-muted-foreground">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          {formOpen && (
            <CustomerForm
              customer={editCustomer}
              onSuccess={() => {
                setFormOpen(false);
                queryClient.invalidateQueries({ queryKey: ["customers"] });
                queryClient.invalidateQueries({ queryKey: ["customers-stats"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <CustomerImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      />

    </DashboardLayout>
  );
}

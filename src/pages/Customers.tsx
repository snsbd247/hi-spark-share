import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, supabaseDirect } from "@/integrations/supabase/client";
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
import { IS_LOVABLE } from "@/lib/environment";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerView from "@/components/customers/CustomerView";
import { generateCustomerPDF } from "@/lib/pdf";
import CustomerImport from "@/components/CustomerImport";
import { usePermissions } from "@/hooks/usePermissions";
import { useInvoiceFooter } from "@/hooks/useInvoiceFooter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Customers() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const connectionFilter = searchParams.get("connection");
  const miscFilter = searchParams.get("filter");
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
      if (IS_LOVABLE) {
        // Get first active router for credentials
        const { data: routerData } = await db.from("mikrotik_routers").select("*").eq("status", "active").limit(1);
        const router = routerData?.[0];
        if (!router) { toast.error("কোনো রাউটার কনফিগার করা নেই"); setBulkSyncing(false); return; }
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/sync-all', {
          body: { router_id: router.id, ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port },
        });
        if (error) throw error;
        if (data?.success) {
          const r = data.results || {};
          if (r.errors?.length && !r.imported && !r.pushed && !r.updated) {
            const errMsg = r.errors[0] || "";
            if (errMsg.includes("Connection refused") || errMsg.includes("timeout")) {
              toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
            } else toast.error(`Sync failed: ${errMsg}`);
          } else {
            const parts = [];
            if (r.pushed > 0) parts.push(`${r.pushed} pushed`);
            if (r.imported > 0) parts.push(`${r.imported} imported`);
            if (r.updated > 0) parts.push(`${r.updated} updated`);
            if (r.failed > 0) parts.push(`${r.failed} failed`);
            toast.success(`Sync complete: ${parts.join(", ")}`);
            queryClient.invalidateQueries({ queryKey: ["customers"] });
          }
        } else toast.error(data?.error || "Sync failed");
      } else {
        const res = await api.post('/mikrotik/sync-all', {});
        const data = res.data;
        if (data.success) {
          const r = data.results;
          const parts = [];
          if (r.pushed > 0) parts.push(`${r.pushed} pushed`);
          if (r.imported > 0) parts.push(`${r.imported} imported`);
          if (r.updated > 0) parts.push(`${r.updated} updated`);
          if (r.failed > 0) parts.push(`${r.failed} failed`);
          if (r.synced !== undefined) parts.push(`${r.synced} synced`);
          toast.success(`Sync complete: ${parts.join(", ")}`);
          if (r.errors?.length > 0) toast.warning(`Errors: ${r.errors.slice(0, 3).join("; ")}`);
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        } else toast.error(data.error || "Bulk sync failed");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Could not connect to MikroTik";
      if (IS_LOVABLE && (msg.includes("Connection refused") || msg.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
      } else toast.error(msg);
    } finally { setBulkSyncing(false); }
  };

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await db
        .from("customers")
        .select("*, packages(name), mikrotik_routers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch customers with unpaid bills for Due List
  const { data: dueCustomerIds } = useQuery({
    queryKey: ["due-customer-ids"],
    queryFn: async () => {
      const { data, error } = await db
        .from("bills")
        .select("customer_id")
        .eq("status", "unpaid");
      if (error) throw error;
      return [...new Set(data?.map((b) => b.customer_id) || [])];
    },
    enabled: miscFilter === "due",
  });

  const filtered = customers?.filter(
    (c) => {
      const s = search.toLowerCase();
      return (c.name || "").toLowerCase().includes(s) ||
        (c.customer_id || "").toLowerCase().includes(s) ||
        (c.phone || "").includes(search) ||
        (c.area || "").toLowerCase().includes(s);
    }
  )?.filter((c) => {
    if (statusFilter) {
      if (statusFilter === "new") {
        // Current month only
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return new Date(c.created_at) >= startOfMonth;
      }
      if (statusFilter === "active") return c.status === "active";
      if (statusFilter === "inactive") return c.status === "inactive";
      if (statusFilter === "suspended") return c.status === "suspended";
      if (statusFilter === "free") return Number(c.monthly_bill) === 0;
      if (statusFilter === "left") return c.status === "left";
      return c.status === statusFilter;
    }
    if (connectionFilter) {
      if (connectionFilter === "online") return c.connection_status === "active" || c.connection_status === "online";
      if (connectionFilter === "offline") return c.connection_status === "offline" || c.connection_status === "disconnected";
    }
    if (miscFilter === "due") {
      return dueCustomerIds?.includes(c.id) ?? false;
    }
    return true;
  });

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

  const pageTitle = useMemo(() => {
    if (statusFilter === "new") return t.sidebar.newCustomers;
    if (statusFilter === "active") return t.sidebar.activeCustomers;
    if (statusFilter === "inactive") return t.sidebar.inactiveCustomers;
    if (statusFilter === "free") return t.sidebar.freeCustomers;
    if (statusFilter === "left") return t.sidebar.leftCustomers;
    if (connectionFilter === "online") return t.sidebar.onlineCustomers;
    if (connectionFilter === "offline") return t.sidebar.offlineCustomers;
    if (miscFilter === "due") return t.sidebar.dueList;
    return t.customers.title;
  }, [statusFilter, connectionFilter, miscFilter, t]);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1">
            {totalItems} {t.customers.customersFound}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={bulkSyncCustomers} disabled={bulkSyncing}>
            {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{t.customers.syncAll}</span>
            <span className="sm:hidden">Sync</span>
          </Button>
          {canCreate && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{t.billing.uploadExcel}</span>
              </Button>
              <Button size="sm" onClick={() => { setEditCustomer(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{t.customers.addCustomer}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.common.search + "..."} className="pl-9" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
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
                    <TableHead>{t.customers.customerId}</TableHead>
                    <TableHead>{t.common.name}</TableHead>
                    <TableHead>{t.common.phone}</TableHead>
                    <TableHead>{t.customers.area}</TableHead>
                    <TableHead>{t.customers.package}</TableHead>
                    <TableHead>{t.customers.monthlyBill}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>MikroTik</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                        {t.customers.noCustomersFound}
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
                <span>{t.table.showing} {totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, totalItems)} {t.table.of} {totalItems}</span>
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
                <span>{t.customers.perPage}</span>
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
                   {t.customers.page} {safeCurrentPage} {t.table.of} {totalPages}
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
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomer ? t.customers.editCustomer : t.customers.addCustomer}</DialogTitle>
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

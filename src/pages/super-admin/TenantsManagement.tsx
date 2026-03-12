import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, Plus, Loader2, Pause, Play, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const TENANT_TABLES = [
  "ticket_replies", "support_tickets", "reminder_logs", "sms_logs", "merchant_payments",
  "payments", "customer_ledger", "bills", "customer_sessions", "customers",
  "packages", "mikrotik_routers", "olts", "onus", "zones",
  "role_permissions", "permissions", "custom_roles", "user_roles", "profiles",
  "admin_login_logs", "admin_sessions", "audit_logs", "backup_logs",
  "sms_settings", "sms_templates", "payment_gateways", "general_settings",
  "tenant_subscriptions",
];

export default function TenantsManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"soft" | "permanent">("soft");
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [form, setForm] = useState({ company_name: "", subdomain: "", contact_email: "", max_customers: "500" });
  const [editForm, setEditForm] = useState({ company_name: "", contact_email: "", max_customers: "500" });
  const [confirmName, setConfirmName] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["sa-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createTenant = useMutation({
    mutationFn: async () => {
      const subdomain = form.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!subdomain || !form.company_name) throw new Error("Company name and subdomain are required");
      const { data, error } = await supabase.from("tenants" as any).insert({
        company_name: form.company_name, subdomain,
        contact_email: form.contact_email || null,
        max_customers: parseInt(form.max_customers) || 500,
      }).select().single();
      if (error) throw error;
      await supabase.from("general_settings" as any).insert({
        site_name: form.company_name, email: form.contact_email || null, tenant_id: (data as any).id,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-tenants"] });
      toast.success("Tenant created successfully");
      setOpen(false);
      setForm({ company_name: "", subdomain: "", contact_email: "", max_customers: "500" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTenant = useMutation({
    mutationFn: async () => {
      if (!selectedTenant) throw new Error("No tenant selected");
      const { error } = await supabase.from("tenants" as any).update({
        company_name: editForm.company_name,
        contact_email: editForm.contact_email || null,
        max_customers: parseInt(editForm.max_customers) || 500,
      }).eq("id", selectedTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-tenants"] });
      toast.success("Tenant updated");
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "suspended" : "active";
      const { error } = await supabase.from("tenants" as any).update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-tenants"] });
      toast.success("Tenant status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTenant = useMutation({
    mutationFn: async () => {
      if (!selectedTenant) throw new Error("No tenant selected");
      if (deleteMode === "soft") {
        const { error } = await supabase.from("tenants" as any).update({ status: "inactive" }).eq("id", selectedTenant.id);
        if (error) throw error;
      } else {
        // Permanent delete: cascade through all tenant tables
        for (const table of TENANT_TABLES) {
          await supabase.from(table as any).delete().eq("tenant_id", selectedTenant.id);
        }
        const { error } = await supabase.from("tenants" as any).delete().eq("id", selectedTenant.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-tenants"] });
      toast.success(deleteMode === "soft" ? "Tenant deactivated" : "Tenant permanently deleted");
      setDeleteOpen(false);
      setConfirmName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (t: any) => {
    setSelectedTenant(t);
    setEditForm({ company_name: t.company_name, contact_email: t.contact_email || "", max_customers: String(t.max_customers || 500) });
    setEditOpen(true);
  };

  const openDelete = (t: any) => {
    setSelectedTenant(t);
    setDeleteMode("soft");
    setConfirmName("");
    setDeleteOpen(true);
  };

  return (
    <SuperAdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
          <p className="text-muted-foreground mt-1">Manage ISP tenants on the platform</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New ISP Tenant</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Company Name *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="ABC Networks" /></div>
              <div>
                <Label>Subdomain *</Label>
                <div className="flex items-center gap-2">
                  <Input value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="abc" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.yourdomain.com</span>
                </div>
              </div>
              <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="admin@abc.com" /></div>
              <div><Label>Max Customers</Label><Input type="number" value={form.max_customers} onChange={(e) => setForm({ ...form, max_customers: e.target.value })} /></div>
              <Button onClick={() => createTenant.mutate()} disabled={createTenant.isPending} className="w-full">
                {createTenant.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Tenant
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Company Name</Label><Input value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} /></div>
            <div><Label>Max Customers</Label><Input type="number" value={editForm.max_customers} onChange={(e) => setEditForm({ ...editForm, max_customers: e.target.value })} /></div>
            <Button onClick={() => updateTenant.mutate()} disabled={updateTenant.isPending} className="w-full">
              {updateTenant.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Delete Tenant</DialogTitle>
            <DialogDescription>Choose how to remove "{selectedTenant?.company_name}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Delete Mode</Label>
              <Select value={deleteMode} onValueChange={(v: "soft" | "permanent") => setDeleteMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft">Soft Delete (Recommended) — Sets status to inactive</SelectItem>
                  <SelectItem value="permanent">Permanent Delete — Removes all data forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deleteMode === "permanent" && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  <strong>Warning:</strong> This will permanently delete all tenant data including customers, bills, payments, and settings. This action cannot be undone.
                </div>
                <Label>Type "{selectedTenant?.company_name}" to confirm</Label>
                <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Type tenant name..." />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteTenant.mutate()}
                disabled={deleteTenant.isPending || (deleteMode === "permanent" && confirmName !== selectedTenant?.company_name)}
              >
                {deleteTenant.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {deleteMode === "soft" ? "Deactivate" : "Delete Permanently"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !tenants?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No tenants yet. Create your first ISP tenant.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Max Customers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.company_name}</TableCell>
                    <TableCell>{t.subdomain}</TableCell>
                    <TableCell>{t.contact_email || "—"}</TableCell>
                    <TableCell>{t.max_customers}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "active" ? "default" : t.status === "inactive" ? "outline" : "destructive"}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(t.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleStatus.mutate({ id: t.id, status: t.status })} title={t.status === "active" ? "Suspend" : "Activate"}>
                        {t.status === "active" ? <Pause className="h-4 w-4 text-muted-foreground" /> : <Play className="h-4 w-4 text-primary" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(t)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}

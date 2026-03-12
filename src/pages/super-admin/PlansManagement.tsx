import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Loader2, Package, Pencil, Trash2 } from "lucide-react";

const emptyForm = { name: "", description: "", max_customers: "100", max_users: "5", monthly_price: "999", yearly_price: "9990" };

export default function PlansManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["sa-plans-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans" as any).select("*").order("monthly_price", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscription_plans" as any).insert({
        name: form.name, description: form.description || null,
        max_customers: parseInt(form.max_customers), max_users: parseInt(form.max_users),
        monthly_price: parseFloat(form.monthly_price), yearly_price: parseFloat(form.yearly_price),
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-plans-all"] }); toast.success("Plan created"); setOpen(false); setForm(emptyForm); },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePlan = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) return;
      const { error } = await supabase.from("subscription_plans" as any).update({
        name: editForm.name, description: editForm.description || null,
        max_customers: parseInt(editForm.max_customers), max_users: parseInt(editForm.max_users),
        monthly_price: parseFloat(editForm.monthly_price), yearly_price: parseFloat(editForm.yearly_price),
      }).eq("id", selectedPlan.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-plans-all"] }); toast.success("Plan updated"); setEditOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePlan = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) return;
      const { error } = await supabase.from("subscription_plans" as any).delete().eq("id", selectedPlan.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-plans-all"] }); toast.success("Plan deleted"); setDeleteOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("subscription_plans" as any).update({ is_active: !is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-plans-all"] }); toast.success("Plan updated"); },
  });

  const openEdit = (p: any) => {
    setSelectedPlan(p);
    setEditForm({
      name: p.name, description: p.description || "",
      max_customers: String(p.max_customers), max_users: String(p.max_users),
      monthly_price: String(p.monthly_price), yearly_price: String(p.yearly_price),
    });
    setEditOpen(true);
  };

  const formFields = (f: typeof form, setF: (v: typeof form) => void) => (
    <div className="space-y-4 mt-4">
      <div><Label>Plan Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Professional" /></div>
      <div><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Max Customers</Label><Input type="number" value={f.max_customers} onChange={(e) => setF({ ...f, max_customers: e.target.value })} /></div>
        <div><Label>Max Users</Label><Input type="number" value={f.max_users} onChange={(e) => setF({ ...f, max_users: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Monthly Price (৳)</Label><Input type="number" value={f.monthly_price} onChange={(e) => setF({ ...f, monthly_price: e.target.value })} /></div>
        <div><Label>Yearly Price (৳)</Label><Input type="number" value={f.yearly_price} onChange={(e) => setF({ ...f, yearly_price: e.target.value })} /></div>
      </div>
    </div>
  );

  return (
    <SuperAdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">Manage platform subscription plans for ISPs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Create Plan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Subscription Plan</DialogTitle></DialogHeader>
            {formFields(form, setForm)}
            <Button onClick={() => createPlan.mutate()} disabled={createPlan.isPending} className="w-full">
              {createPlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Plan
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Plan</DialogTitle></DialogHeader>
          {formFields(editForm, setEditForm)}
          <Button onClick={() => updatePlan.mutate()} disabled={updatePlan.isPending} className="w-full">
            {updatePlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
            <DialogDescription>Are you sure you want to delete "{selectedPlan?.name}"? Active subscriptions using this plan will be affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletePlan.mutate()} disabled={deletePlan.isPending}>
              {deletePlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !plans?.length ? (
            <div className="text-center py-12 text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-3 opacity-50" /><p>No plans yet.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Max Customers</TableHead>
                  <TableHead>Max Users</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Yearly</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.max_customers}</TableCell>
                    <TableCell>{p.max_users}</TableCell>
                    <TableCell>৳{Number(p.monthly_price).toLocaleString()}</TableCell>
                    <TableCell>৳{Number(p.yearly_price).toLocaleString()}</TableCell>
                    <TableCell>
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive.mutate({ id: p.id, is_active: p.is_active })} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedPlan(p); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

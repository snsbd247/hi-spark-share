import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Loader2, CreditCard, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionsManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editEndDate, setEditEndDate] = useState("");
  const [editPlan, setEditPlan] = useState("");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["sa-subscriptions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_subscriptions" as any).select("*, tenants(company_name), subscription_plans(name, monthly_price)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["sa-tenants-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants" as any).select("id, company_name").eq("status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["sa-plans-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans" as any).select("id, name").eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const createSubscription = useMutation({
    mutationFn: async () => {
      if (!selectedTenant || !selectedPlan) throw new Error("Select tenant and plan");
      const { error } = await supabase.from("tenant_subscriptions" as any).insert({ tenant_id: selectedTenant, plan_id: selectedPlan });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-subscriptions-all"] }); toast.success("Subscription assigned"); setOpen(false); setSelectedTenant(""); setSelectedPlan(""); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateSubscription = useMutation({
    mutationFn: async () => {
      if (!selectedSub) return;
      const updates: any = { status: editStatus, plan_id: editPlan };
      if (editEndDate) updates.end_date = new Date(editEndDate).toISOString();
      const { error } = await supabase.from("tenant_subscriptions" as any).update(updates).eq("id", selectedSub.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-subscriptions-all"] }); toast.success("Subscription updated"); setEditOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSubscription = useMutation({
    mutationFn: async () => {
      if (!selectedSub) return;
      const { error } = await supabase.from("tenant_subscriptions" as any).delete().eq("id", selectedSub.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sa-subscriptions-all"] }); toast.success("Subscription deleted"); setDeleteOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (s: any) => {
    setSelectedSub(s);
    setEditStatus(s.status);
    setEditPlan(s.plan_id);
    setEditEndDate(s.end_date ? format(new Date(s.end_date), "yyyy-MM-dd") : "");
    setEditOpen(true);
  };

  return (
    <SuperAdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Manage tenant subscription assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Assign Plan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Subscription Plan</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Tenant</Label>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>{tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>{plans?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => createSubscription.mutate()} disabled={createSubscription.isPending} className="w-full">
                {createSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Subscription</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{plans?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
            </div>
            <Button onClick={() => updateSubscription.mutate()} disabled={updateSubscription.isPending} className="w-full">
              {updateSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subscription</DialogTitle>
            <DialogDescription>Are you sure? This will remove the subscription record for {selectedSub?.tenants?.company_name}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteSubscription.mutate()} disabled={deleteSubscription.isPending}>
              {deleteSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !subscriptions?.length ? (
            <div className="text-center py-12 text-muted-foreground"><CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" /><p>No subscriptions yet.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price/mo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.tenants?.company_name ?? "—"}</TableCell>
                    <TableCell>{s.subscription_plans?.name ?? "—"}</TableCell>
                    <TableCell>৳{Number(s.subscription_plans?.monthly_price ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : s.status === "expired" ? "destructive" : "secondary"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(s.start_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{s.end_date ? format(new Date(s.end_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedSub(s); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

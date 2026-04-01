import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperPlans() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "",
    price_monthly: "0", price_yearly: "0",
    max_customers: "100", max_users: "5", max_routers: "2",
    has_accounting: false, has_hr: false, has_inventory: false,
    has_sms: true, has_custom_domain: false,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["super-plans"],
    queryFn: superAdminApi.getPlans,
  });

  const createMut = useMutation({
    mutationFn: superAdminApi.createPlan,
    onSuccess: () => { toast.success("Plan created"); setShowCreate(false); qc.invalidateQueries({ queryKey: ["super-plans"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: superAdminApi.deletePlan,
    onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["super-plans"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Plan Management</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Create Plan</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Subscription Plan</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="starter" required />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Price (৳)</Label>
                  <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Yearly Price (৳)</Label>
                  <Input type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Customers</Label>
                  <Input type="number" value={form.max_customers} onChange={(e) => setForm({ ...form, max_customers: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Users</Label>
                  <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "has_accounting", label: "Accounting" },
                  { key: "has_hr", label: "HR Module" },
                  { key: "has_inventory", label: "Inventory" },
                  { key: "has_sms", label: "SMS" },
                  { key: "has_custom_domain", label: "Custom Domain" },
                ].map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Switch checked={(form as any)[f.key]} onCheckedChange={(v) => setForm({ ...form, [f.key]: v })} />
                    <Label className="text-sm">{f.label}</Label>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Plan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : plans.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>৳{Number(p.price_monthly).toLocaleString()}</TableCell>
                  <TableCell>৳{Number(p.price_yearly).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">
                    {p.max_customers} customers · {p.max_users} users · {p.max_routers} routers
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.has_accounting && <Badge variant="secondary" className="text-xs">Accounting</Badge>}
                      {p.has_hr && <Badge variant="secondary" className="text-xs">HR</Badge>}
                      {p.has_inventory && <Badge variant="secondary" className="text-xs">Inventory</Badge>}
                      {p.has_sms && <Badge variant="secondary" className="text-xs">SMS</Badge>}
                      {p.has_custom_domain && <Badge variant="secondary" className="text-xs">Custom Domain</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{p.subscriptions_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this plan?")) deleteMut.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

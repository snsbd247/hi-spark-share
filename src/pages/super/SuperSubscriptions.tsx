import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperSubscriptions() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ tenant_id: "", plan_id: "", billing_cycle: "monthly", start_date: new Date().toISOString().split("T")[0] });

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["super-subscriptions"],
    queryFn: () => superAdminApi.getSubscriptions(),
  });

  const { data: tenants = [] } = useQuery({ queryKey: ["super-tenants-list"], queryFn: () => superAdminApi.getTenants() });
  const { data: plans = [] } = useQuery({ queryKey: ["super-plans"], queryFn: superAdminApi.getPlans });

  const assignMut = useMutation({
    mutationFn: superAdminApi.assignSubscription,
    onSuccess: () => { toast.success("Subscription assigned"); setShowAssign(false); qc.invalidateQueries({ queryKey: ["super-subscriptions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor = (s: string) => s === "active" ? "default" : s === "expired" ? "destructive" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{sa.subscriptions}</h1>
        <Dialog open={showAssign} onOpenChange={setShowAssign}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> {sa.assignSubscriptionBtn}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{sa.assignSubscription}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); assignMut.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>{sa.tenant}</Label>
                <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                  <SelectTrigger><SelectValue placeholder={sa.selectTenant} /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.subdomain})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{sa.plan}</Label>
                <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder={sa.selectPlan} /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.billingCycle}</Label>
                  <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{sa.monthly}</SelectItem>
                      <SelectItem value="yearly">{sa.yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{sa.startDate}</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={assignMut.isPending}>
                {assignMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Assign
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
                <TableHead>{sa.tenant}</TableHead>
                <TableHead>{sa.plan}</TableHead>
                <TableHead>{sa.cycle}</TableHead>
                <TableHead>{sa.amount}</TableHead>
                <TableHead>{sa.period}</TableHead>
                <TableHead>{t.common.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : subscriptions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.tenant?.name || "—"}</TableCell>
                  <TableCell>{s.plan?.name || "—"}</TableCell>
                  <TableCell className="capitalize">{s.billing_cycle}</TableCell>
                  <TableCell>৳{Number(s.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.start_date} → {s.end_date}</TableCell>
                  <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

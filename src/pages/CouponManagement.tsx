import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Tag, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CouponManagement() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discount_type: "fixed", discount_value: 0, max_uses: 0, valid_from: "", valid_until: "" });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["coupons", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (d: typeof form) => {
      const { error } = await db.from("coupons").insert({
        code: d.code.toUpperCase(),
        description: d.description || null,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        max_uses: d.max_uses || 0,
        valid_from: d.valid_from || null,
        valid_until: d.valid_until || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["coupons", tenantId] }); toast.success(t.couponPage.couponCreated); setOpen(false); setForm({ code: "", description: "", discount_type: "fixed", discount_value: 0, max_uses: 0, valid_from: "", valid_until: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["coupons", tenantId] }); toast.success(t.couponPage.couponDeleted); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from("coupons").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons", tenantId] }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.couponPage.title}</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> {t.couponPage.addCoupon}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.couponPage.createCoupon}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>{t.couponPage.code}</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SAVE20" /></div>
                <div><Label>{t.common.description}</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t.couponPage.type}</Label>
                    <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="fixed">{t.couponPage.fixedAmount}</SelectItem><SelectItem value="percentage">{t.couponPage.percentage}</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t.couponPage.value}</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} /></div>
                </div>
                <div><Label>{t.couponPage.maxUses}</Label><Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t.couponPage.validFrom}</Label><Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} /></div>
                  <div><Label>{t.couponPage.validUntil}</Label><Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
                </div>
                <Button onClick={() => createMutation.mutate(form)} disabled={!form.code || createMutation.isPending} className="w-full">{t.common.create}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> {t.couponPage.activeCoupons} ({coupons.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.couponPage.code}</TableHead><TableHead>{t.couponPage.type}</TableHead><TableHead>{t.couponPage.value}</TableHead>
                  <TableHead>{t.couponPage.used}</TableHead><TableHead>{t.couponPage.validUntil}</TableHead><TableHead>{t.common.status}</TableHead><TableHead>{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-bold">{c.code}</TableCell>
                    <TableCell>{c.discount_type === "percentage" ? <Percent className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}</TableCell>
                    <TableCell>{c.discount_type === "percentage" ? `${c.discount_value}%` : `৳${c.discount_value}`}</TableCell>
                    <TableCell>{c.used_count}/{c.max_uses || "∞"}</TableCell>
                    <TableCell>{c.valid_until ? safeFormat(c.valid_until, "dd MMM yyyy", "-") : t.couponPage.noLimit}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleMutation.mutate({ id: c.id, is_active: !c.is_active })}>
                        {c.is_active ? t.couponPage.active : t.couponPage.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!coupons.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t.couponPage.noCouponsFound}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/integrations/db/client";

export default function LoanManagement() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", amount: "", monthly_deduction: "", reason: "" });
  const { data: employees = [] } = useQuery({ queryKey: ["employees-active"], queryFn: async () => { const { data } = await ( db as any).from("employees").select("*").eq("status", "active"); return data || []; } });
  const { data: loans = [], isLoading } = useQuery({ queryKey: ["loans"], queryFn: async () => { const { data } = await ( db as any).from("loans").select("*").order("created_at", { ascending: false }); return data || []; } });

  const save = useMutation({
    mutationFn: async () => { await ( db as any).from("loans").insert({ employee_id: form.employee_id, amount: Number(form.amount), monthly_deduction: Number(form.monthly_deduction), reason: form.reason, approved_date: new Date().toISOString().split("T")[0] }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Loan added"); setOpen(false); setForm({ employee_id: "", amount: "", monthly_deduction: "", reason: "" }); },
    onError: () => toast.error("Failed"),
  });

  const getEmpName = (id: string) => employees.find((e: any) => e.id === id)?.name || "—";

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
         <h1 className="text-2xl font-bold">{t.sidebar.loans}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{t.common.add} {t.sidebar.loans}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.common.add} {t.sidebar.loans}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}><SelectTrigger><SelectValue placeholder={t.sidebar.employees} /></SelectTrigger><SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
              <Input placeholder={t.common.amount} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <Input placeholder={t.hr.monthlyDeduction} type="number" value={form.monthly_deduction} onChange={(e) => setForm({ ...form, monthly_deduction: e.target.value })} />
              <Input placeholder={t.common.description} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <Button onClick={() => save.mutate()} disabled={!form.employee_id || !form.amount || save.isPending} className="w-full">{save.isPending ? t.common.loading : t.common.save}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.sidebar.loans}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>{t.sidebar.employees}</TableHead><TableHead>{t.common.amount}</TableHead><TableHead>{t.hr.paidAmount}</TableHead><TableHead>{t.hr.monthlyDeduction}</TableHead><TableHead>{t.hr.remaining}</TableHead><TableHead>{t.common.status}</TableHead></TableRow></TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <TableRow key={l.id}><TableCell className="font-medium">{getEmpName(l.employee_id)}</TableCell><TableCell>৳{Number(l.amount).toLocaleString()}</TableCell><TableCell>৳{Number(l.paid_amount).toLocaleString()}</TableCell><TableCell>৳{Number(l.monthly_deduction).toLocaleString()}</TableCell><TableCell className="font-semibold">৳{(Number(l.amount) - Number(l.paid_amount)).toLocaleString()}</TableCell><TableCell><Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge></TableCell></TableRow>
                ))}
                {loans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t.common.noData}</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

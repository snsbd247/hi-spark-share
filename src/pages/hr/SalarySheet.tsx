import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { format } from "date-fns";
import { generatePaySlipPdf } from "@/lib/salaryPaySlipPdf";

export default function SalarySheet() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const now = new Date();
  const [month, setMonth] = useState(format(now, "yyyy-MM"));

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["salary-sheets", month, tenantId],
    queryFn: async () => { const { data } = await scopeByTenant((db as any).from("salary_sheets").select("*").eq("month", month), tenantId); return data || []; },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant((db as any).from("employees").select("*").eq("status", "active"), tenantId); return data || []; },
  });

  const { data: salaryStructures = [] } = useQuery({
    queryKey: ["all-salary-structures", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant((db as any).from("employee_salary_structure").select("*").order("effective_from", { ascending: false }), tenantId); return data || []; },
  });

  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => { const { data } = await ( db as any).from("general_settings").select("*").limit(1).single(); return data; },
  });

  const getStructure = (empId: string) => salaryStructures.find((s: any) => s.employee_id === empId);

  const generate = useMutation({
    mutationFn: async () => {
      const { data: loans } = await ( db as any).from("loans").select("*").eq("status", "active");
      for (const emp of employees) {
        const structure = getStructure(emp.id);
        const basic = structure ? Number(structure.basic_salary) : Number(emp.salary);
        const houseRent = structure ? Number(structure.house_rent) : 0;
        const medical = structure ? Number(structure.medical) : 0;
        const conveyance = structure ? Number(structure.conveyance) : 0;
        const otherAllowance = structure ? Number(structure.other_allowance) : 0;
        const gross = basic + houseRent + medical + conveyance + otherAllowance;
        const ld = (loans || []).filter((l: any) => l.employee_id === emp.id).reduce((s: number, l: any) => s + Number(l.monthly_deduction), 0);
        const net = gross - ld;

        // Check if already exists
        const { data: existing } = await ( db as any).from("salary_sheets").select("id").eq("employee_id", emp.id).eq("month", month).maybeSingle();
        const payload = {
          employee_id: emp.id,
          month,
          basic_salary: basic,
          house_rent: houseRent,
          medical,
          conveyance,
          other_allowance: otherAllowance,
          bonus: 0,
          deduction: 0,
          loan_deduction: ld,
          net_salary: net,
          status: "pending" as const,
        };
        if (existing) {
          await ( db as any).from("salary_sheets").update(payload).eq("id", existing.id);
        } else {
          await ( db as any).from("salary_sheets").insert(payload);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salary-sheets"] }); toast.success("Generated from salary structure"); },
    onError: () => toast.error("Failed"),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => { await ( db as any).from("salary_sheets").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salary-sheets"] }); toast.success("Paid"); },
  });

  const getEmpName = (id: string) => employees.find((e: any) => e.id === id)?.name || "—";
  const getEmpId = (id: string) => employees.find((e: any) => e.id === id)?.employee_id || "—";
  const total = sheets.reduce((s: number, r: any) => s + Number(r.net_salary), 0);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), i, 1); return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") }; });

  const generatePaySlip = (sheet: any) => {
    const emp = employees.find((e: any) => e.id === sheet.employee_id);
    if (!emp) return;
    generatePaySlipPdf({
      employee: emp,
      sheet,
      companyName: settings?.site_name || "Company",
      companyAddress: settings?.address || "",
    });
    toast.success("Pay Slip downloaded");
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t.sidebar.salarySheet}</h1>
        <div className="flex gap-3">
          <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}><FileText className="h-4 w-4 mr-2" />{generate.isPending ? t.common.loading : t.hr.generateSalary}</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.hr.salary} — {month} ({t.common.total}: ৳{total.toLocaleString()})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>{t.sidebar.employees}</TableHead>
                    <TableHead className="text-right">{t.hr.basicSalary}</TableHead>
                    <TableHead className="text-right">{t.hr.houseRent}</TableHead>
                    <TableHead className="text-right">{t.hr.medical}</TableHead>
                    <TableHead className="text-right">{t.hr.conveyance}</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">{t.hr.loanDeduction}</TableHead>
                    <TableHead className="text-right">{t.hr.netSalary}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheets.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{getEmpId(s.employee_id)}</TableCell>
                      <TableCell className="font-medium">{getEmpName(s.employee_id)}</TableCell>
                      <TableCell className="text-right">৳{Number(s.basic_salary).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(s.house_rent || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(s.medical || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(s.conveyance || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(s.bonus).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(s.loan_deduction).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">৳{Number(s.net_salary).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={s.status === "paid" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {s.status === "pending" && <Button size="sm" variant="outline" onClick={() => markPaid.mutate(s.id)}><CheckCircle className="h-3 w-3 mr-1" />{t.hr.paySalary}</Button>}
                          <Button size="sm" variant="ghost" onClick={() => generatePaySlip(s)}><Download className="h-3 w-3 mr-1" />Slip</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sheets.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">{t.common.noData}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

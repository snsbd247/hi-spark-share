import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { generatePaySlipPdf } from "@/lib/salaryPaySlipPdf";

export default function SalarySheet() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(format(now, "yyyy-MM"));

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["salary-sheets", month],
    queryFn: async () => { const { data } = await ( supabase as any).from("salary_sheets").select("*").eq("month", month); return data || []; },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => { const { data } = await ( supabase as any).from("employees").select("*").eq("status", "active"); return data || []; },
  });

  const { data: salaryStructures = [] } = useQuery({
    queryKey: ["all-salary-structures"],
    queryFn: async () => { const { data } = await ( supabase as any).from("employee_salary_structure").select("*").order("effective_from", { ascending: false }); return data || []; },
  });

  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => { const { data } = await ( supabase as any).from("general_settings").select("*").limit(1).single(); return data; },
  });

  const getStructure = (empId: string) => salaryStructures.find((s: any) => s.employee_id === empId);

  const generate = useMutation({
    mutationFn: async () => {
      const { data: loans } = await ( supabase as any).from("loans").select("*").eq("status", "active");
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
        const { data: existing } = await ( supabase as any).from("salary_sheets").select("id").eq("employee_id", emp.id).eq("month", month).maybeSingle();
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
          await ( supabase as any).from("salary_sheets").update(payload).eq("id", existing.id);
        } else {
          await ( supabase as any).from("salary_sheets").insert(payload);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salary-sheets"] }); toast.success("Generated from salary structure"); },
    onError: () => toast.error("Failed"),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => { await ( supabase as any).from("salary_sheets").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salary-sheets"] }); toast.success("Paid"); },
  });

  const getEmpName = (id: string) => employees.find((e: any) => e.id === id)?.name || "—";
  const getEmpId = (id: string) => employees.find((e: any) => e.id === id)?.employee_id || "—";
  const total = sheets.reduce((s: number, r: any) => s + Number(r.net_salary), 0);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), i, 1); return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") }; });

  const generatePaySlip = (sheet: any) => {
    const emp = employees.find((e: any) => e.id === sheet.employee_id);
    if (!emp) return;
    const doc = new jsPDF();
    const companyName = settings?.site_name || "Company";
    const companyAddress = settings?.address || "";

    // Header
    doc.setFontSize(18);
    doc.text(companyName, 105, 20, { align: "center" });
    doc.setFontSize(10);
    if (companyAddress) doc.text(companyAddress, 105, 27, { align: "center" });
    doc.setFontSize(14);
    doc.text("Pay Slip", 105, 36, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Month: ${sheet.month}`, 105, 43, { align: "center" });

    doc.line(15, 48, 195, 48);

    // Employee Info
    let y = 56;
    doc.setFontSize(11);
    doc.text("Employee ID:", 20, y); doc.text(emp.employee_id, 70, y);
    doc.text("Name:", 120, y); doc.text(emp.name, 145, y);
    y += 8;
    doc.text("Phone:", 20, y); doc.text(emp.phone || "—", 70, y);
    doc.text("Email:", 120, y); doc.text(emp.email || "—", 145, y);

    doc.line(15, y + 6, 195, y + 6);
    y += 14;

    // Earnings
    doc.setFontSize(12);
    doc.text("Earnings", 20, y);
    doc.text("Amount (BDT)", 170, y, { align: "right" });
    y += 8;
    doc.setFontSize(10);
    const earnings = [
      ["Basic Salary", Number(sheet.basic_salary)],
      ["House Rent", Number(sheet.house_rent || 0)],
      ["Medical Allowance", Number(sheet.medical || 0)],
      ["Conveyance", Number(sheet.conveyance || 0)],
      ["Other Allowance", Number(sheet.other_allowance || 0)],
      ["Bonus", Number(sheet.bonus)],
    ];
    for (const [label, amount] of earnings) {
      if (amount as number > 0) {
        doc.text(label as string, 25, y);
        doc.text(`${(amount as number).toLocaleString()}`, 170, y, { align: "right" });
        y += 7;
      }
    }

    const grossTotal = earnings.reduce((s, [, a]) => s + (a as number), 0);
    doc.line(20, y, 190, y);
    y += 6;
    doc.setFontSize(11);
    doc.text("Gross Salary", 25, y);
    doc.text(`${grossTotal.toLocaleString()}`, 170, y, { align: "right" });
    y += 12;

    // Deductions
    doc.setFontSize(12);
    doc.text("Deductions", 20, y);
    y += 8;
    doc.setFontSize(10);
    const deductions = [
      ["Loan Deduction", Number(sheet.loan_deduction)],
      ["Other Deduction", Number(sheet.deduction)],
    ];
    for (const [label, amount] of deductions) {
      if (amount as number > 0) {
        doc.text(label as string, 25, y);
        doc.text(`${(amount as number).toLocaleString()}`, 170, y, { align: "right" });
        y += 7;
      }
    }
    const totalDeductions = deductions.reduce((s, [, a]) => s + (a as number), 0);
    doc.line(20, y, 190, y);
    y += 6;
    doc.text("Total Deductions", 25, y);
    doc.text(`${totalDeductions.toLocaleString()}`, 170, y, { align: "right" });
    y += 12;

    // Net Pay
    doc.setFontSize(14);
    doc.text("Net Pay:", 25, y);
    doc.text(`BDT ${Number(sheet.net_salary).toLocaleString()}`, 170, y, { align: "right" });
    y += 8;
    doc.line(15, y, 195, y);
    y += 10;

    doc.setFontSize(9);
    doc.text("Status: " + sheet.status.toUpperCase(), 20, y);
    if (sheet.paid_date) doc.text("Paid Date: " + safeFormat(sheet.paid_date, "dd MMM yyyy"), 120, y);

    y += 20;
    doc.line(20, y, 80, y);
    doc.line(130, y, 190, y);
    y += 5;
    doc.setFontSize(9);
    doc.text("Employee Signature", 30, y);
    doc.text("Authorized Signature", 140, y);

    doc.save(`PaySlip-${emp.employee_id}-${sheet.month}.pdf`);
    toast.success("Pay Slip downloaded");
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Salary Sheet</h1>
        <div className="flex gap-3">
          <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}><FileText className="h-4 w-4 mr-2" />{generate.isPending ? "Generating..." : "Generate"}</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Salary — {month} (Total: ৳{total.toLocaleString()})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">House Rent</TableHead>
                    <TableHead className="text-right">Medical</TableHead>
                    <TableHead className="text-right">Conv.</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Loan Ded.</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
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
                          {s.status === "pending" && <Button size="sm" variant="outline" onClick={() => markPaid.mutate(s.id)}><CheckCircle className="h-3 w-3 mr-1" />Pay</Button>}
                          <Button size="sm" variant="ghost" onClick={() => generatePaySlip(s)}><Download className="h-3 w-3 mr-1" />Slip</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sheets.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">No records. Click Generate.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

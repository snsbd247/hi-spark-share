import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db } from "@/integrations/db/client";
import { format, endOfMonth } from "date-fns";

export default function MonthlyAttendance() {
  const { t } = useLanguage();
  const now = new Date();
  const [month, setMonth] = useState(format(now, "yyyy-MM"));
  const { data: employees = [] } = useQuery({ queryKey: ["employees-active"], queryFn: async () => { const { data } = await ( db as any).from("employees").select("*").eq("status", "active").order("employee_id"); return data || []; } });
  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ["attendance-monthly", month],
    queryFn: async () => { const { data } = await ( db as any).from("attendance").select("*").gte("date", `${month}-01`).lte("date", format(endOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd")); return data || []; },
  });
  const getSummary = (empId: string) => {
    const a = attendance.filter((x: any) => x.employee_id === empId);
    return { present: a.filter((x: any) => x.status === "present").length, absent: a.filter((x: any) => x.status === "absent").length, late: a.filter((x: any) => x.status === "late").length, leave: a.filter((x: any) => x.status === "leave").length, total: a.length };
  };
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), i, 1); return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") }; });

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t.sidebar.monthlyAttendance}</h1>
        <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.sidebar.monthlyAttendance} — {month}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>{t.common.name}</TableHead><TableHead className="text-center">{t.hr.present}</TableHead><TableHead className="text-center">{t.hr.late}</TableHead><TableHead className="text-center">{t.hr.absent}</TableHead><TableHead className="text-center">{t.hr.leave}</TableHead><TableHead className="text-center">{t.common.total}</TableHead></TableRow></TableHeader>
              <TableBody>
                {employees.map((e: any) => { const s = getSummary(e.id); return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono">{e.employee_id}</TableCell><TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-center"><Badge>{s.present}</Badge></TableCell><TableCell className="text-center"><Badge variant="outline">{s.late}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="destructive">{s.absent}</Badge></TableCell><TableCell className="text-center"><Badge variant="secondary">{s.leave}</Badge></TableCell>
                    <TableCell className="text-center">{s.total}</TableCell>
                  </TableRow>
                ); })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

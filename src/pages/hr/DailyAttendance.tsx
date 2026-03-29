import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function DailyAttendance() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [records, setRecords] = useState<Record<string, { status: string; check_in: string; check_out: string }>>({});

  const { data: employees = [] } = useQuery({ queryKey: ["employees-active"], queryFn: async () => { const { data } = await ( supabase as any).from("employees").select("*").eq("status", "active").order("employee_id"); return data || []; } });

  useQuery({
    queryKey: ["attendance", selectedDate],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("attendance").select("*").eq("date", selectedDate);
      const rec: Record<string, any> = {};
      (data || []).forEach((a: any) => { rec[a.employee_id] = { status: a.status, check_in: a.check_in || "", check_out: a.check_out || "" }; });
      setRecords(rec);
      return data || [];
    },
  });

  const getR = (id: string) => records[id] || { status: "present", check_in: "09:00", check_out: "18:00" };
  const upd = (id: string, f: string, v: string) => setRecords((p) => ({ ...p, [id]: { ...getR(id), [f]: v } }));

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const emp of employees) {
        const r = getR(emp.id);
        await ( supabase as any).from("attendance").upsert({ employee_id: emp.id, date: selectedDate, status: r.status, check_in: r.check_in || null, check_out: r.check_out || null });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); toast.success("Attendance saved"); },
    onError: () => toast.error("Failed to save"),
  });

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Daily Attendance</h1>
        <div className="flex gap-3 items-center">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44" />
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}><Save className="h-4 w-4 mr-2" />{saveMut.isPending ? "Saving..." : "Save"}</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Attendance — {selectedDate}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead></TableRow></TableHeader>
            <TableBody>
              {employees.map((emp: any) => { const r = getR(emp.id); return (
                <TableRow key={emp.id}>
                  <TableCell className="font-mono">{emp.employee_id}</TableCell>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => upd(emp.id, "status", v)}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="present">Present</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="leave">Leave</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="time" value={r.check_in} onChange={(e) => upd(emp.id, "check_in", e.target.value)} className="w-32" /></TableCell>
                  <TableCell><Input type="time" value={r.check_out} onChange={(e) => upd(emp.id, "check_out", e.target.value)} className="w-32" /></TableCell>
                </TableRow>
              ); })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

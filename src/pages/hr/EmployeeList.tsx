import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiDb } from "@/lib/apiDb";

export default function EmployeeList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = { employee_id: "", name: "", phone: "", email: "", designation_id: "", joining_date: "", salary: "", address: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["employees"], queryFn: async () => { const { data } = await apiDb.from("employees").select("*").order("employee_id"); return data || []; } });
  const { data: desigs = [] } = useQuery({ queryKey: ["designations"], queryFn: async () => { const { data } = await apiDb.from("designations").select("*").eq("status", "active"); return data || []; } });

  const save = useMutation({
    mutationFn: async () => {
      const p: any = { ...form, salary: Number(form.salary) || 0 };
      if (!p.designation_id) delete p.designation_id;
      if (editId) await apiDb.from("employees").update(p).eq("id", editId);
      else await apiDb.from("employees").insert(p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm(emptyForm); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({ mutationFn: async (id: string) => { await apiDb.from("employees").delete().eq("id", id); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Deleted"); } });
  const getDesName = (id: string) => desigs.find((d: any) => d.id === id)?.name || "—";

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Employee List</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Employee</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Employee</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Employee ID" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} disabled={!!editId} />
              <Input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Select value={form.designation_id} onValueChange={(v) => setForm({ ...form, designation_id: v })}>
                <SelectTrigger><SelectValue placeholder="Designation" /></SelectTrigger>
                <SelectContent>{desigs.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
              <Input placeholder="Salary" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.name || !form.employee_id || save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>Employees ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Designation</TableHead><TableHead>Salary</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono">{e.employee_id}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.phone || "—"}</TableCell>
                    <TableCell>{getDesName(e.designation_id)}</TableCell>
                    <TableCell>৳{Number(e.salary).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(e.id); setForm({ employee_id: e.employee_id, name: e.name, phone: e.phone||"", email: e.email||"", designation_id: e.designation_id||"", joining_date: e.joining_date||"", salary: String(e.salary||0), address: e.address||"" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No employees</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

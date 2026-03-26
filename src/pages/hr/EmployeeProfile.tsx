import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Pencil, Trash2, User, GraduationCap, Briefcase, DollarSign, Phone, Shield, PiggyBank } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiDb } from "@/lib/apiDb";

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: employee } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data } = await apiDb.from("employees").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: designation } = useQuery({
    queryKey: ["designation", employee?.designation_id],
    queryFn: async () => {
      const { data } = await apiDb.from("designations").select("name").eq("id", employee!.designation_id!).single();
      return data;
    },
    enabled: !!employee?.designation_id,
  });

  if (!employee) return <DashboardLayout><p className="text-center py-12 text-muted-foreground">Loading...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/hr/employees")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{employee.name}</h1>
          <p className="text-sm text-muted-foreground">ID: {employee.employee_id} • {designation?.name || "—"} • <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{employee.phone || "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{employee.email || "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Joining Date</p><p className="font-medium">{employee.joining_date || "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Salary</p><p className="font-medium">৳{Number(employee.salary).toLocaleString()}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="education">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="education"><GraduationCap className="h-4 w-4 mr-1" />Education</TabsTrigger>
          <TabsTrigger value="experience"><Briefcase className="h-4 w-4 mr-1" />Experience</TabsTrigger>
          <TabsTrigger value="salary"><DollarSign className="h-4 w-4 mr-1" />Salary Structure</TabsTrigger>
          <TabsTrigger value="pf"><Shield className="h-4 w-4 mr-1" />Provident Fund</TabsTrigger>
          <TabsTrigger value="savings"><PiggyBank className="h-4 w-4 mr-1" />Savings Fund</TabsTrigger>
          <TabsTrigger value="emergency"><Phone className="h-4 w-4 mr-1" />Emergency Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="education"><EducationTab employeeId={id!} /></TabsContent>
        <TabsContent value="experience"><ExperienceTab employeeId={id!} /></TabsContent>
        <TabsContent value="salary"><SalaryStructureTab employeeId={id!} currentSalary={Number(employee.salary)} /></TabsContent>
        <TabsContent value="pf"><ProvidentFundTab employeeId={id!} employeeName={employee.name} /></TabsContent>
        <TabsContent value="savings"><SavingsFundTab employeeId={id!} employeeName={employee.name} /></TabsContent>
        <TabsContent value="emergency"><EmergencyContactTab employeeId={id!} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

/* ── Education Tab ── */
function EducationTab({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { degree: "", institution: "", board_university: "", passing_year: "", result: "" };
  const [form, setForm] = useState(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employee-education", employeeId],
    queryFn: async () => { const { data } = await apiDb.from("employee_education").select("*").eq("employee_id", employeeId).order("passing_year", { ascending: false }); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) await apiDb.from("employee_education").update(form).eq("id", editId);
      else await apiDb.from("employee_education").insert({ ...form, employee_id: employeeId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-education"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm(empty); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiDb.from("employee_education").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-education"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">Education History</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Education</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Degree *</Label><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="e.g. BSc in CSE" /></div>
              <div><Label>Institution *</Label><Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="University / College" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Board/University</Label><Input value={form.board_university} onChange={(e) => setForm({ ...form, board_university: e.target.value })} /></div>
                <div><Label>Passing Year</Label><Input value={form.passing_year} onChange={(e) => setForm({ ...form, passing_year: e.target.value })} placeholder="2020" /></div>
                <div><Label>Result</Label><Input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="3.50/4.00" /></div>
              </div>
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.degree || !form.institution || save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Degree</TableHead><TableHead>Institution</TableHead><TableHead>Board/University</TableHead><TableHead>Year</TableHead><TableHead>Result</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.degree}</TableCell>
                <TableCell>{r.institution}</TableCell>
                <TableCell>{r.board_university || "—"}</TableCell>
                <TableCell>{r.passing_year || "—"}</TableCell>
                <TableCell>{r.result || "—"}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ degree: r.degree, institution: r.institution, board_university: r.board_university || "", passing_year: r.passing_year || "", result: r.result || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No education records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Experience Tab ── */
function ExperienceTab({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { company_name: "", designation: "", from_date: "", to_date: "", responsibilities: "" };
  const [form, setForm] = useState(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employee-experience", employeeId],
    queryFn: async () => { const { data } = await apiDb.from("employee_experience").select("*").eq("employee_id", employeeId).order("from_date", { ascending: false }); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.from_date) delete payload.from_date;
      if (!payload.to_date) delete payload.to_date;
      if (editId) await apiDb.from("employee_experience").update(payload).eq("id", editId);
      else await apiDb.from("employee_experience").insert({ ...payload, employee_id: employeeId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-experience"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm(empty); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiDb.from("employee_experience").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-experience"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">Work Experience</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Experience</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Company Name *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label>Designation *</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>From Date</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                <div><Label>To Date</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
              </div>
              <div><Label>Responsibilities</Label><Textarea value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} rows={3} /></div>
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.company_name || !form.designation || save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Designation</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Responsibilities</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.company_name}</TableCell>
                <TableCell>{r.designation}</TableCell>
                <TableCell>{r.from_date || "—"}</TableCell>
                <TableCell>{r.to_date || "Present"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.responsibilities || "—"}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ company_name: r.company_name, designation: r.designation, from_date: r.from_date || "", to_date: r.to_date || "", responsibilities: r.responsibilities || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No experience records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Salary Structure Tab ── */
function SalaryStructureTab({ employeeId, currentSalary }: { employeeId: string; currentSalary: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { basic_salary: "", house_rent: "", medical: "", conveyance: "", other_allowance: "", effective_from: new Date().toISOString().split("T")[0] };
  const [form, setForm] = useState(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employee-salary-structure", employeeId],
    queryFn: async () => { const { data } = await apiDb.from("employee_salary_structure").select("*").eq("employee_id", employeeId).order("effective_from", { ascending: false }); return data || []; },
  });

  const total = Number(form.basic_salary || 0) + Number(form.house_rent || 0) + Number(form.medical || 0) + Number(form.conveyance || 0) + Number(form.other_allowance || 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        basic_salary: Number(form.basic_salary) || 0,
        house_rent: Number(form.house_rent) || 0,
        medical: Number(form.medical) || 0,
        conveyance: Number(form.conveyance) || 0,
        other_allowance: Number(form.other_allowance) || 0,
        effective_from: form.effective_from,
      };
      if (editId) await apiDb.from("employee_salary_structure").update(payload).eq("id", editId);
      else await apiDb.from("employee_salary_structure").insert({ ...payload, employee_id: employeeId });
      // Update employee's total salary
      const grossSalary = payload.basic_salary + payload.house_rent + payload.medical + payload.conveyance + payload.other_allowance;
      await apiDb.from("employees").update({ salary: grossSalary }).eq("id", employeeId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-salary-structure"] }); qc.invalidateQueries({ queryKey: ["employee"] }); toast.success("Saved & Employee salary updated"); setOpen(false); setEditId(null); setForm(empty); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiDb.from("employee_salary_structure").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-salary-structure"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">Salary Structure (Current Gross: ৳{currentSalary.toLocaleString()})</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Structure</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Salary Structure</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Basic Salary</Label><Input type="number" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} /></div>
                <div><Label>House Rent</Label><Input type="number" value={form.house_rent} onChange={(e) => setForm({ ...form, house_rent: e.target.value })} /></div>
                <div><Label>Medical</Label><Input type="number" value={form.medical} onChange={(e) => setForm({ ...form, medical: e.target.value })} /></div>
                <div><Label>Conveyance</Label><Input type="number" value={form.conveyance} onChange={(e) => setForm({ ...form, conveyance: e.target.value })} /></div>
                <div><Label>Other Allowance</Label><Input type="number" value={form.other_allowance} onChange={(e) => setForm({ ...form, other_allowance: e.target.value })} /></div>
                <div><Label>Effective From</Label><Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} /></div>
              </div>
              <div className="bg-muted rounded-md p-3 text-center">
                <p className="text-sm text-muted-foreground">Gross Salary</p>
                <p className="text-xl font-bold">৳{total.toLocaleString()}</p>
              </div>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Effective From</TableHead><TableHead className="text-right">Basic</TableHead><TableHead className="text-right">House Rent</TableHead><TableHead className="text-right">Medical</TableHead><TableHead className="text-right">Conveyance</TableHead><TableHead className="text-right">Other</TableHead><TableHead className="text-right">Gross</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any, idx: number) => {
              const gross = Number(r.basic_salary) + Number(r.house_rent) + Number(r.medical) + Number(r.conveyance) + Number(r.other_allowance);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.effective_from}{idx === 0 && <Badge className="ml-2" variant="default">Current</Badge>}</TableCell>
                  <TableCell className="text-right">৳{Number(r.basic_salary).toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳{Number(r.house_rent).toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳{Number(r.medical).toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳{Number(r.conveyance).toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳{Number(r.other_allowance).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">৳{gross.toLocaleString()}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ basic_salary: String(r.basic_salary), house_rent: String(r.house_rent), medical: String(r.medical), conveyance: String(r.conveyance), other_allowance: String(r.other_allowance), effective_from: r.effective_from }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div></TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No salary structure defined</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Emergency Contact Tab ── */
function EmergencyContactTab({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { contact_name: "", relation: "", phone: "", address: "" };
  const [form, setForm] = useState(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employee-emergency", employeeId],
    queryFn: async () => { const { data } = await apiDb.from("employee_emergency_contacts").select("*").eq("employee_id", employeeId); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) await apiDb.from("employee_emergency_contacts").update(form).eq("id", editId);
      else await apiDb.from("employee_emergency_contacts").insert({ ...form, employee_id: employeeId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-emergency"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm(empty); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiDb.from("employee_emergency_contacts").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-emergency"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">Emergency Contacts</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Emergency Contact</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name *</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Relation *</Label><Input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="e.g. Father, Wife" /></div>
                <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.contact_name || !form.relation || !form.phone || save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relation</TableHead><TableHead>Phone</TableHead><TableHead>Address</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.contact_name}</TableCell>
                <TableCell>{r.relation}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>{r.address || "—"}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ contact_name: r.contact_name, relation: r.relation, phone: r.phone, address: r.address || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No emergency contacts</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Provident Fund Tab ── */
function ProvidentFundTab({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { type: "contribution", amount: "", employee_share: "", employer_share: "", date: new Date().toISOString().split("T")[0], description: "" };
  const [form, setForm] = useState(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employee-pf", employeeId],
    queryFn: async () => { const { data } = await apiDb.from("employee_provident_fund").select("*").eq("employee_id", employeeId).order("date", { ascending: false }); return data || []; },
  });

  const totalBalance = rows.reduce((s: number, r: any) => {
    if (r.type === "withdrawal") return s - Number(r.amount);
    return s + Number(r.amount);
  }, 0);
  const totalEmployeeShare = rows.filter((r: any) => r.type !== "withdrawal").reduce((s: number, r: any) => s + Number(r.employee_share), 0);
  const totalEmployerShare = rows.filter((r: any) => r.type !== "withdrawal").reduce((s: number, r: any) => s + Number(r.employer_share), 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        type: form.type,
        amount: Number(form.amount) || 0,
        employee_share: Number(form.employee_share) || 0,
        employer_share: Number(form.employer_share) || 0,
        date: form.date,
        description: form.description || null,
      };
      if (editId) await apiDb.from("employee_provident_fund").update(payload).eq("id", editId);
      else await apiDb.from("employee_provident_fund").insert({ ...payload, employee_id: employeeId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-pf"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm(empty); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiDb.from("employee_provident_fund").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-pf"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Provident Fund</CardTitle>
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
            <span>Balance: <strong className="text-foreground">৳{totalBalance.toLocaleString()}</strong></span>
            <span>Employee: ৳{totalEmployeeShare.toLocaleString()}</span>
            <span>Employer: ৳{totalEmployerShare.toLocaleString()}</span>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} PF Entry</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contribution">Contribution</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    <SelectItem value="interest">Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === "contribution" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Employee Share</Label><Input type="number" value={form.employee_share} onChange={(e) => { const v = e.target.value; setForm({ ...form, employee_share: v, amount: String(Number(v) + Number(form.employer_share)) }); }} /></div>
                  <div><Label>Employer Share</Label><Input type="number" value={form.employer_share} onChange={(e) => { const v = e.target.value; setForm({ ...form, employer_share: v, amount: String(Number(form.employee_share) + Number(v)) }); }} /></div>
                </div>
              ) : (
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Total Amount</Label><Input value={`৳${Number(form.amount || 0).toLocaleString()}`} disabled /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional note" /></div>
            </div>
            <Button onClick={() => save.mutate()} disabled={!Number(form.amount) || save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Employee</TableHead><TableHead className="text-right">Employer</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Description</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.date}</TableCell>
                <TableCell><Badge variant={r.type === "withdrawal" ? "destructive" : r.type === "interest" ? "secondary" : "default"}>{r.type}</Badge></TableCell>
                <TableCell className="text-right">৳{Number(r.employee_share).toLocaleString()}</TableCell>
                <TableCell className="text-right">৳{Number(r.employer_share).toLocaleString()}</TableCell>
                <TableCell className="text-right font-semibold">{r.type === "withdrawal" ? "-" : ""}৳{Number(r.amount).toLocaleString()}</TableCell>
                <TableCell className="max-w-[150px] truncate">{r.description || "—"}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ type: r.type, amount: String(r.amount), employee_share: String(r.employee_share), employer_share: String(r.employer_share), date: r.date, description: r.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No provident fund records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Savings Fund Tab ── */
function SavingsFundTab({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { type: "deposit", amount: "", date: new Date().toISOString().split("T")[0], description: "" };
  const [form, setForm] = useState(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employee-savings", employeeId],
    queryFn: async () => { const { data } = await apiDb.from("employee_savings_fund").select("*").eq("employee_id", employeeId).order("date", { ascending: false }); return data || []; },
  });

  const totalBalance = rows.reduce((s: number, r: any) => {
    if (r.type === "withdrawal") return s - Number(r.amount);
    return s + Number(r.amount);
  }, 0);
  const totalDeposit = rows.filter((r: any) => r.type === "deposit").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalWithdrawal = rows.filter((r: any) => r.type === "withdrawal").reduce((s: number, r: any) => s + Number(r.amount), 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { type: form.type, amount: Number(form.amount) || 0, date: form.date, description: form.description || null };
      if (editId) await apiDb.from("employee_savings_fund").update(payload).eq("id", editId);
      else await apiDb.from("employee_savings_fund").insert({ ...payload, employee_id: employeeId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-savings"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm(empty); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiDb.from("employee_savings_fund").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-savings"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Savings Fund</CardTitle>
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
            <span>Balance: <strong className="text-foreground">৳{totalBalance.toLocaleString()}</strong></span>
            <span>Total Deposit: ৳{totalDeposit.toLocaleString()}</span>
            <span>Total Withdrawal: ৳{totalWithdrawal.toLocaleString()}</span>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Savings Entry</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    <SelectItem value="interest">Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional note" /></div>
            </div>
            <Button onClick={() => save.mutate()} disabled={!Number(form.amount) || save.isPending} className="w-full mt-2">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Description</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.date}</TableCell>
                <TableCell><Badge variant={r.type === "withdrawal" ? "destructive" : r.type === "interest" ? "secondary" : "default"}>{r.type}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{r.type === "withdrawal" ? "-" : ""}৳{Number(r.amount).toLocaleString()}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.description || "—"}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ type: r.type, amount: String(r.amount), date: r.date, description: r.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No savings fund records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

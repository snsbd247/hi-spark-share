import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ChequeRegister() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    cheque_no: "", bank_name: "", amount: 0, date: new Date().toISOString().split("T")[0],
    party_name: "", type: "received", status: "pending", description: "",
  });

  // Use transactions table with reference prefix "CHQ-" to track cheques
  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ["cheques"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("transactions").select("*").like("reference", "CHQ-%").order("date", { ascending: false });
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await ( supabase as any).from("transactions").insert({
        description: `${form.type === "received" ? "Cheque Received" : "Cheque Issued"}: ${form.cheque_no} - ${form.party_name} (${form.bank_name})${form.description ? " - " + form.description : ""}`,
        debit: form.type === "received" ? form.amount : 0,
        credit: form.type === "issued" ? form.amount : 0,
        type: "journal",
        reference: `CHQ-${form.cheque_no}`,
        date: form.date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cheque entry added");
      qc.invalidateQueries({ queryKey: ["cheques"] });
      setOpen(false);
      setForm({ cheque_no: "", bank_name: "", amount: 0, date: new Date().toISOString().split("T")[0], party_name: "", type: "received", status: "pending", description: "" });
    },
    onError: () => toast.error("Failed to add cheque"),
  });

  const filtered = cheques.filter((c: any) => {
    if (search && !(c.description || "").toLowerCase().includes(search.toLowerCase()) && !(c.reference || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalReceived = filtered.reduce((s: number, c: any) => s + Number(c.debit || 0), 0);
  const totalIssued = filtered.reduce((s: number, c: any) => s + Number(c.credit || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Cheque Register</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Cheque Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Cheque Entry</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cheque No</Label><Input value={form.cheque_no} onChange={e => setForm({ ...form, cheque_no: e.target.value })} /></div>
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Party Name</Label><Input value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} /></div>
                <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
                <div><Label>Description (optional)</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.cheque_no || !form.amount}>Save Cheque Entry</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Entries</p><p className="text-lg font-bold">{filtered.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Received</p><p className="text-lg font-bold text-green-600">৳{totalReceived.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Issued</p><p className="text-lg font-bold text-destructive">৳{totalIssued.toLocaleString()}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cheque Entries</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Cheque No</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{safeFormat(c.date, "dd MMM yyyy")}</TableCell>
                      <TableCell className="font-mono">{c.reference?.replace("CHQ-", "")}</TableCell>
                      <TableCell className="font-medium">{c.description}</TableCell>
                      <TableCell>
                        <Badge variant={Number(c.debit) > 0 ? "default" : "destructive"}>
                          {Number(c.debit) > 0 ? "Received" : "Issued"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ৳{(Number(c.debit) || Number(c.credit)).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No cheque entries</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

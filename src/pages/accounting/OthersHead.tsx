import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, BookOpen, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function OthersHead() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "asset", code: "", description: "", parent_id: "" });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ["accounts-flat"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("accounts").select("*").order("code").order("name");
      return data || [];
    },
  });

  // Others = asset, liability, equity (not income/expense)
  const rows = allAccounts.filter((a: any) => ["asset", "liability", "equity"].includes(a.type));

  const save = useMutation({
    mutationFn: async () => {
      const parentAccount = form.parent_id ? allAccounts.find((a: any) => a.id === form.parent_id) : null;
      const level = parentAccount ? (parentAccount.level || 0) + 1 : 0;
      const payload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        parent_id: form.parent_id || null,
        type: form.type,
        level,
      };
      if (editId) {
        await ( supabase as any).from("accounts").update(payload).eq("id", editId);
      } else {
        await ( supabase as any).from("accounts").insert(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts-flat"] });
      toast.success("Saved");
      setOpen(false);
      setEditId(null);
      setForm({ name: "", type: "asset", code: "", description: "", parent_id: "" });
    },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await ( supabase as any).from("accounts").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts-flat"] }); toast.success("Deleted"); },
  });

  const otherParents = allAccounts.filter((a: any) => ["asset", "liability", "equity"].includes(a.type));

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Others Head</h1>
          <p className="text-sm text-muted-foreground">Chart of Accounts → Asset, Liability & Equity ledgers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/accounting/chart-of-accounts")}>
            <ArrowRight className="h-4 w-4 mr-1" /> Full Chart of Accounts
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: "", type: "asset", code: "", description: "", parent_id: "" }); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Ledger</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Ledger</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Code</Label><Input placeholder="e.g. 1001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type *</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset">Asset</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                        <SelectItem value="equity">Equity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Parent Account</Label>
                    <Select value={form.parent_id || "none"} onValueChange={v => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="None (Root)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Root Level)</SelectItem>
                        {otherParents.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{"─".repeat(a.level || 0)} {a.name} {a.code ? `(${a.code})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="w-full">{save.isPending ? "Saving..." : "Save"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Asset / Liability / Equity Ledgers ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Balance</TableHead><TableHead>{t.common.actions}</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.code || "—"}</code></TableCell>
                  <TableCell><Badge variant="outline" className={TYPE_COLORS[r.type] || ""}>{r.type}</Badge></TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className="font-mono">৳{Number(r.balance || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/accounting/ledger-statement?account_id=${r.id}&name=${encodeURIComponent(r.name)}&code=${encodeURIComponent(r.code || "")}`)} title="View Statement"><BookOpen className="h-4 w-4" /></Button>
                      {!r.is_system && <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ name: r.name, type: r.type, code: r.code || "", description: r.description || "", parent_id: r.parent_id || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                      {!r.is_system && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if(confirm("Delete?")) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No ledgers found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

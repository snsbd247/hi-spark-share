import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/integrations/db/client";

export default function DesignationList() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["designations"],
    queryFn: async () => { const { data } = await ( db as any).from("designations").select("*").order("created_at", { ascending: false }); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) await ( db as any).from("designations").update(form).eq("id", editId);
      else await ( db as any).from("designations").insert(form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["designations"] }); toast.success("Saved"); setOpen(false); setEditId(null); setForm({ name: "", description: "" }); },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await ( db as any).from("designations").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["designations"] }); toast.success("Deleted"); },
  });

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t.sidebar.designations}</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: "", description: "" }); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{t.common.add} {t.sidebar.designations}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? t.common.edit : t.common.add} {t.sidebar.designations}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder={t.common.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder={t.common.description} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="w-full">{save.isPending ? t.common.loading : t.common.save}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.sidebar.designations}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>{t.common.name}</TableHead><TableHead>{t.common.description}</TableHead><TableHead>{t.common.status}</TableHead><TableHead>{t.common.actions}</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.description || "—"}</TableCell>
                    <TableCell><Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                    <TableCell><div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(d.id); setForm({ name: d.name, description: d.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t.common.noData}</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

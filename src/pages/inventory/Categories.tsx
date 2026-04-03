import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Categories() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [search, setSearch] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await (db as any).from("categories").select("*").order("name");
      return data || [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        await (db as any).from("categories").update({ name: form.name, description: form.description || null }).eq("id", editing.id);
      } else {
        await (db as any).from("categories").insert({ name: form.name, description: form.description || null });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editing ? t.inventory.categoryUpdated : t.inventory.categoryCreated);
      setOpen(false);
      setEditing(null);
      setForm({ name: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message || t.common.error),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await (db as any).from("categories").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t.inventory.categoryDeleted);
    },
  });

  const filtered = categories.filter((c: any) => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.inventory.productCategories}</h1>
            <p className="text-muted-foreground text-sm">{t.inventory.organizeByCategory}</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ name: "", description: "" }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> {t.inventory.addCategory}
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.inventory.searchCategories} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.name}</TableHead>
                  <TableHead>{t.common.description}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t.inventory.noCategoriesFound}</TableCell></TableRow>
                ) : filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                    <TableCell><Badge variant="default">{c.status || t.common.active}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setForm({ name: c.name, description: c.description || "" }); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(t.common.confirm + "?")) deleteMut.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? t.inventory.editCategory : t.inventory.addCategory}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t.common.name} *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Routers" />
              </div>
              <div>
                <Label>{t.common.description}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t.inventory.optionalDescription} />
              </div>
              <Button className="w-full" disabled={!form.name.trim() || saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? t.common.loading : editing ? t.common.update : t.common.create}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

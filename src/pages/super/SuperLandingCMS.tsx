import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, GripVertical, Globe } from "lucide-react";
import { toast } from "sonner";

const SECTION_TYPES = [
  { value: "hero", label: "Hero Banner" },
  { value: "stat", label: "Stat Counter" },
  { value: "feature", label: "Feature" },
  { value: "testimonial", label: "Testimonial" },
  { value: "faq", label: "FAQ" },
  { value: "footer", label: "Footer" },
];

const TYPE_COLORS: Record<string, string> = {
  hero: "bg-primary/10 text-primary",
  stat: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  feature: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  testimonial: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  faq: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  footer: "bg-muted text-muted-foreground",
};

interface LandingSection {
  id: string;
  section_type: string;
  sort_order: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  metadata: any;
  is_active: boolean;
}

export default function SuperLandingCMS() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LandingSection | null>(null);
  const [deleteItem, setDeleteItem] = useState<LandingSection | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState({
    section_type: "feature",
    sort_order: 0,
    title: "",
    subtitle: "",
    description: "",
    icon: "",
    image_url: "",
    link_url: "",
    link_text: "",
    metadata_json: "{}",
    is_active: true,
  });

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["landing-sections"],
    queryFn: async () => {
      const { data, error } = await (db as any).from("landing_sections").select("*").order("section_type").order("sort_order");
      if (error) throw error;
      return data as LandingSection[];
    },
  });

  const filtered = filterType === "all" ? sections : sections.filter(s => s.section_type === filterType);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let metadata = {};
      try { metadata = JSON.parse(form.metadata_json || "{}"); } catch { throw new Error("Invalid JSON in metadata"); }

      const payload = {
        section_type: form.section_type,
        sort_order: form.sort_order,
        title: form.title || null,
        subtitle: form.subtitle || null,
        description: form.description || null,
        icon: form.icon || null,
        image_url: form.image_url || null,
        link_url: form.link_url || null,
        link_text: form.link_text || null,
        metadata,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await (db as any).from("landing_sections").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (db as any).from("landing_sections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Section updated" : "Section created");
      qc.invalidateQueries({ queryKey: ["landing-sections"] });
      setFormOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db as any).from("landing_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section deleted");
      qc.invalidateQueries({ queryKey: ["landing-sections"] });
      setDeleteItem(null);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (db as any).from("landing_sections").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing-sections"] }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ section_type: "feature", sort_order: 0, title: "", subtitle: "", description: "", icon: "", image_url: "", link_url: "", link_text: "", metadata_json: "{}", is_active: true });
    setFormOpen(true);
  };

  const openEdit = (s: LandingSection) => {
    setEditing(s);
    setForm({
      section_type: s.section_type,
      sort_order: s.sort_order,
      title: s.title || "",
      subtitle: s.subtitle || "",
      description: s.description || "",
      icon: s.icon || "",
      image_url: s.image_url || "",
      link_url: s.link_url || "",
      link_text: s.link_text || "",
      metadata_json: JSON.stringify(s.metadata || {}, null, 2),
      is_active: s.is_active,
    });
    setFormOpen(true);
  };

  const typeCounts = sections.reduce((acc: Record<string, number>, s) => {
    acc[s.section_type] = (acc[s.section_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6" /> Landing Page CMS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all sections of the public landing page</p>
        </div>
        <div className="flex gap-2">
          <a href="/landing" target="_blank" rel="noopener">
            <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" /> Preview</Button>
          </a>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Section</Button>
        </div>
      </div>

      {/* Type Filter + Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={filterType === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterType("all")}
        >
          All ({sections.length})
        </Badge>
        {SECTION_TYPES.map(t => (
          <Badge
            key={t.value}
            variant={filterType === t.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterType(t.value)}
          >
            {t.label} ({typeCounts[t.value] || 0})
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, i) => (
                <TableRow key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{s.sort_order}</TableCell>
                  <TableCell><Badge className={TYPE_COLORS[s.section_type] || ""}>{s.section_type}</Badge></TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{s.title || "—"}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-muted-foreground text-sm">{s.description || s.subtitle || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{s.icon || "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ id: s.id, active: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteItem(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No sections found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Section" : "Add Section"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Section Type *</Label>
                <Select value={form.section_type} onValueChange={v => setForm({ ...form, section_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Icon (Lucide name)</Label>
                <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="e.g. CreditCard, Shield" />
              </div>
              <div className="space-y-1.5">
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Link URL</Label>
                <Input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Link Text</Label>
                <Input value={form.link_text} onChange={e => setForm({ ...form, link_text: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Metadata (JSON)</Label>
              <Textarea value={form.metadata_json} onChange={e => setForm({ ...form, metadata_json: e.target.value })} rows={4} className="font-mono text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteItem?.title}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function FaqManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ question: "", answer: "", category: "general", sort_order: 0 });

  const { data: faqs = [] } = useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const { data, error } = await db.from("faqs").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (d: typeof form & { id?: string }) => {
      if (d.id) {
        const { error } = await db.from("faqs").update({ question: d.question, answer: d.answer, category: d.category, sort_order: d.sort_order }).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("faqs").insert(d);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["faqs"] }); toast.success("FAQ saved"); setOpen(false); setEditId(null); setForm({ question: "", answer: "", category: "general", sort_order: 0 }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("faqs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["faqs"] }); toast.success("Deleted"); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await db.from("faqs").update({ is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["faqs"] }),
  });

  const categories = [...new Set(faqs.map((f: any) => f.category))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">FAQ Management</h1>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm({ question: "", answer: "", category: "general", sort_order: 0 }); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add FAQ</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} FAQ</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Question</Label><Input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} /></div>
                <div><Label>Answer</Label><Textarea rows={4} value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
                  <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
                </div>
                <Button onClick={() => saveMutation.mutate(editId ? { ...form, id: editId } : form)} disabled={!form.question || !form.answer} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {categories.length > 0 ? categories.map((cat: string) => (
          <Card key={cat}>
            <CardHeader><CardTitle className="flex items-center gap-2 capitalize"><HelpCircle className="h-5 w-5" /> {String(cat)}</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="multiple">
                {faqs.filter((f: any) => f.category === cat).map((faq: any) => (
                  <AccordionItem value={faq.id} key={faq.id}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2 flex-1">
                        <span>{faq.question}</span>
                        {!faq.is_published && <Badge variant="secondary">Draft</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground mb-3 whitespace-pre-wrap">{faq.answer}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setForm({ question: faq.question, answer: faq.answer, category: faq.category, sort_order: faq.sort_order }); setEditId(faq.id); setOpen(true); }}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate({ id: faq.id, is_published: !faq.is_published })}>
                          {faq.is_published ? "Unpublish" : "Publish"}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(faq.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />No FAQs yet. Click "Add FAQ" to create one.</CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}

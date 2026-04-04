import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

interface Serial {
  id: string;
  product_id: string;
  serial_number: string;
  status: string;
  notes: string;
  product?: { name: string };
}

export default function ProductSerials() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ product_id: "", serial_number: "", notes: "" });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSerials, setBulkSerials] = useState("");

  const { data: serials = [], isLoading } = useQuery({
    queryKey: ["product_serials", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("product_serials").select("*,product:products(name)").order("created_at", { ascending: false }), tenantId);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("products").select("id,name").order("name"), tenantId);
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (bulkMode) {
        const serialList = bulkSerials.split(',').map(s => s.trim()).filter(Boolean);
        if (serialList.length === 0) throw new Error("No serials provided");
        const uniqueSerials = [...new Set(serialList)];
        if (uniqueSerials.length !== serialList.length) {
          throw new Error("Duplicate serials found in input");
        }
        const { data: existing } = await (db as any).from("product_serials")
          .select("serial_number")
          .in("serial_number", uniqueSerials);
        const existingSet = new Set((existing || []).map((e: any) => e.serial_number));
        const conflicts = uniqueSerials.filter(s => existingSet.has(s));
        if (conflicts.length > 0) {
          throw new Error(`Duplicate serials already exist: ${conflicts.join(', ')}`);
        }
        const rows = uniqueSerials.map(s => ({
          product_id: form.product_id, serial_number: s,
          notes: form.notes || null, status: "available",
        }));
        const { error } = await (db as any).from("product_serials").insert(rows);
        if (error) throw error;
      } else {
        const { error } = await (db as any).from("product_serials").insert({
          product_id: form.product_id, serial_number: form.serial_number.trim(),
          notes: form.notes || null, status: "available",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      const count = bulkMode ? bulkSerials.split(',').filter(s => s.trim()).length : 1;
      toast.success(`${count} ${t.inventory.serialsDetected}`);
      setOpen(false);
      setForm({ product_id: "", serial_number: "", notes: "" });
      setBulkSerials(""); setBulkMode(false);
    },
    onError: (e: any) => toast.error(e.message || t.common.error),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await (db as any).from("product_serials").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      toast.success(t.inventory.serialDeleted);
    },
  });

  const filtered = serials.filter((s: Serial) => {
    const matchSearch = s.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.product?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "available": return "default";
      case "assigned": return "secondary";
      case "damaged": return "destructive";
      case "returned": return "outline";
      default: return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.inventory.serialNumbers}</h1>
            <p className="text-muted-foreground text-sm">{t.inventory.trackSerials}</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t.inventory.addSerial}</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.inventory.searchSerials} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.inventory.allStatus}</SelectItem>
              <SelectItem value="available">{t.common.active}</SelectItem>
              <SelectItem value="assigned">{t.inventory.assigned}</SelectItem>
              <SelectItem value="damaged">{t.inventory.damaged}</SelectItem>
              <SelectItem value="returned">{t.inventory.returned}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.fiberTopology.serialNumber}</TableHead>
                  <TableHead>{t.inventory.product}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.common.note}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t.inventory.noSerialsFound}</TableCell></TableRow>
                ) : filtered.map((s: Serial) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.serial_number}</TableCell>
                    <TableCell>{s.product?.name || "—"}</TableCell>
                    <TableCell><Badge variant={statusColor(s.status) as any}>{s.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{s.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      {s.status === "available" && (
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm(t.inventory.deleteSerial)) deleteMut.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setBulkMode(false); setBulkSerials(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{bulkMode ? t.inventory.addSerialBulk : t.inventory.addSerialNumber}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button type="button" variant={bulkMode ? "default" : "outline"} size="sm" onClick={() => setBulkMode(!bulkMode)}>
                  {bulkMode ? `${t.inventory.bulkMode} ✓` : t.inventory.bulkMode}
                </Button>
                {bulkMode && <span className="text-xs text-muted-foreground">{t.inventory.commaSeparatedSerials}</span>}
              </div>
              <div>
                <Label>{t.inventory.product}</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t.inventory.selectProduct} /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bulkMode ? (
                <div>
                  <Label>{t.inventory.serialNumbersCommaSeparated}</Label>
                  <Textarea value={bulkSerials} onChange={e => setBulkSerials(e.target.value)} placeholder="e.g. SN001,SN002,SN003" rows={4} />
                  {bulkSerials && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {bulkSerials.split(',').filter(s => s.trim()).length} {t.inventory.serialsDetected}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <Label>{t.fiberTopology.serialNumber}</Label>
                  <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="e.g. SN-2024-001" />
                </div>
              )}
              <div>
                <Label>{t.common.note}</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={t.inventory.optionalNotes} />
              </div>
              <Button
                className="w-full"
                disabled={!form.product_id || (bulkMode ? !bulkSerials.trim() : !form.serial_number.trim()) || addMut.isPending}
                onClick={() => addMut.mutate()}
              >
                {addMut.isPending ? t.inventory.adding : t.inventory.addSerials}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

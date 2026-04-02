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
import { Plus, Pencil, Trash2, Search, Barcode } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Serial {
  id: string;
  product_id: string;
  serial_number: string;
  status: string;
  notes: string;
  product?: { name: string };
}

export default function ProductSerials() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ product_id: "", serial_number: "", notes: "" });

  const { data: serials = [], isLoading } = useQuery({
    queryKey: ["product_serials"],
    queryFn: async () => {
      const { data } = await (db as any).from("product_serials").select("*,product:products(name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await (db as any).from("products").select("id,name").order("name");
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await (db as any).from("product_serials").insert({
        product_id: form.product_id,
        serial_number: form.serial_number.trim(),
        notes: form.notes || null,
        status: "available",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      toast.success("Serial added");
      setOpen(false);
      setForm({ product_id: "", serial_number: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to add serial"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await (db as any).from("product_serials").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      toast.success("Serial deleted");
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
            <h1 className="text-2xl font-bold text-foreground">Serial Numbers</h1>
            <p className="text-muted-foreground text-sm">Track individual product serial numbers</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Serial</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search serials..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No serials found</TableCell></TableRow>
                ) : filtered.map((s: Serial) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.serial_number}</TableCell>
                    <TableCell>{s.product?.name || "—"}</TableCell>
                    <TableCell><Badge variant={statusColor(s.status) as any}>{s.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{s.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      {s.status === "available" && (
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this serial?")) deleteMut.mutate(s.id); }}>
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

        {/* Add Serial Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Serial Number</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Serial Number</Label>
                <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="e.g. SN-2024-001" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>
              <Button className="w-full" disabled={!form.product_id || !form.serial_number.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
                {addMut.isPending ? "Adding..." : "Add Serial"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

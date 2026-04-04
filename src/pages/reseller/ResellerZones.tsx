import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ZoneForm {
  name: string;
  status: string;
}

const emptyForm: ZoneForm = { name: "", status: "active" };

export default function ResellerZones() {
  const { reseller } = useResellerAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["reseller-zones", reseller?.id],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("reseller_zones")
        .select("*")
        .eq("reseller_id", reseller!.id)
        .eq("tenant_id", reseller!.tenant_id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Zone name is required");

      if (editId) {
        const { error } = await (db as any)
          .from("reseller_zones")
          .update({ name: form.name, status: form.status, updated_at: new Date().toISOString() })
          .eq("id", editId)
          .eq("reseller_id", reseller!.id);
        if (error) throw error;
      } else {
        const { error } = await (db as any)
          .from("reseller_zones")
          .insert({
            name: form.name,
            status: form.status,
            reseller_id: reseller!.id,
            tenant_id: reseller!.tenant_id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Zone updated" : "Zone created");
      queryClient.invalidateQueries({ queryKey: ["reseller-zones"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db as any)
        .from("reseller_zones")
        .delete()
        .eq("id", id)
        .eq("reseller_id", reseller!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone deleted");
      queryClient.invalidateQueries({ queryKey: ["reseller-zones"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (z: any) => {
    setEditId(z.id);
    setForm({ name: z.name, status: z.status });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" /> My Zones
            </h1>
            <p className="text-muted-foreground mt-1">{zones.length} zones</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Zone
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : zones.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No zones created yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((z: any) => (
                    <TableRow key={z.id}>
                      <TableCell className="font-medium">{z.name}</TableCell>
                      <TableCell>
                        <Badge variant={z.status === "active" ? "default" : "secondary"}>{z.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(z.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(z)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this zone?")) deleteMutation.mutate(z.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Zone" : "Add Zone"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Zone Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Block A, Mirpur-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResellerLayout>
  );
}

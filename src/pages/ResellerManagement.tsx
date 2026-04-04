import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Users, Edit, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import bcrypt from "bcryptjs";

interface ResellerForm {
  name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  password: string;
  status: string;
  commission_rate: string;
}

const emptyForm: ResellerForm = {
  name: "", company_name: "", phone: "", email: "", address: "",
  password: "", status: "active", commission_rate: "0",
};

export default function ResellerManagement() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<any>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [form, setForm] = useState<ResellerForm>(emptyForm);

  const { data: resellers = [], isLoading } = useQuery({
    queryKey: ["resellers", tenantId],
    queryFn: async () => {
      let q = (db as any).from("resellers").select("*").order("name");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        company_name: form.company_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        status: form.status,
        commission_rate: parseFloat(form.commission_rate) || 0,
        updated_at: new Date().toISOString(),
      };

      if (form.password) {
        payload.password_hash = await bcrypt.hash(form.password, 10);
      }

      if (editId) {
        const { error } = await (db as any).from("resellers").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        if (!form.password) throw new Error("Password is required for new reseller");
        payload.password_hash = await bcrypt.hash(form.password, 10);
        payload.tenant_id = tenantId;
        const { error } = await (db as any).from("resellers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Reseller updated" : "Reseller created");
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addWalletMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(walletAmount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (!selectedReseller) throw new Error("No reseller selected");

      const newBalance = parseFloat(selectedReseller.wallet_balance) + amount;

      await (db as any).from("reseller_wallet_transactions").insert({
        reseller_id: selectedReseller.id,
        tenant_id: tenantId,
        type: "credit",
        amount,
        balance_after: newBalance,
        description: walletNote || "Balance added by admin",
      });

      await (db as any).from("resellers")
        .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", selectedReseller.id);
    },
    onSuccess: () => {
      toast.success("Balance added successfully");
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      setWalletDialogOpen(false);
      setWalletAmount("");
      setWalletNote("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db as any).from("resellers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reseller deleted");
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      name: r.name, company_name: r.company_name || "", phone: r.phone || "",
      email: r.email || "", address: r.address || "", password: "",
      status: r.status, commission_rate: r.commission_rate?.toString() || "0",
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const filtered = resellers.filter((r: any) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Reseller Management</h1>
            <p className="text-muted-foreground mt-1">Manage your resellers and their wallets</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-60" />
            </div>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Reseller</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No resellers found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.company_name || "—"}</TableCell>
                        <TableCell>{r.phone || "—"}</TableCell>
                        <TableCell>{r.email || "—"}</TableCell>
                        <TableCell className="font-medium">৳{parseFloat(r.wallet_balance).toLocaleString()}</TableCell>
                        <TableCell>{r.commission_rate}%</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "active" ? "default" : "destructive"}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => { setSelectedReseller(r); setWalletDialogOpen(true); }}>
                              <Wallet className="h-3.5 w-3.5 mr-1" /> Add Balance
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                              if (confirm(`Delete reseller "${r.name}"?`)) deleteMutation.mutate(r.id);
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Reseller" : "Add Reseller"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{editId ? "New Password (leave empty to keep)" : "Password *"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Commission Rate (%)</Label>
                <Input type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
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

      {/* Wallet Top-up Dialog */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Wallet Balance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reseller: <strong>{selectedReseller?.name}</strong> — Current: ৳{parseFloat(selectedReseller?.wallet_balance || 0).toLocaleString()}
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Amount (৳)</Label>
              <Input type="number" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} placeholder="1000" />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input value={walletNote} onChange={(e) => setWalletNote(e.target.value)} placeholder="Balance top-up" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => addWalletMutation.mutate()} disabled={addWalletMutation.isPending}>
              {addWalletMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

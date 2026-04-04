import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { useNavigate } from "react-router-dom";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Search, Users, Edit, Wallet, Trash2, Calculator, CheckCircle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import bcrypt from "bcryptjs";

import ResellerPackageAssign from "@/components/reseller/ResellerPackageAssign";
import ResellerPackageCommissions from "@/components/reseller/ResellerPackageCommissions";

interface ResellerForm {
  name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  user_id: string;
  password: string;
  status: string;
  commission_rate: string;
  default_commission: string;
  allow_all_packages: boolean;
}

const emptyForm: ResellerForm = {
  name: "", company_name: "", phone: "", email: "", address: "",
  user_id: "", password: "", status: "active", commission_rate: "0",
  default_commission: "0",
  allow_all_packages: false,
};

export default function ResellerManagement() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { signInAsImpersonation } = useResellerAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<any>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [form, setForm] = useState<ResellerForm>(emptyForm);
  const [impersonating, setImpersonating] = useState(false);
  const [commissionMonth, setCommissionMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: resellers = [], isLoading } = useQuery({
    queryKey: ["resellers", tenantId],
    queryFn: async () => {
      let q = (db as any).from("resellers").select("id, tenant_id, user_id, name, company_name, phone, email, address, commission_rate, default_commission, wallet_balance, status, allow_all_packages, created_at, updated_at").order("name");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: commissions = [], isLoading: loadingComm } = useQuery({
    queryKey: ["reseller-commissions", tenantId],
    queryFn: async () => {
      let q = (db as any).from("reseller_commissions")
        .select("*, resellers(name, company_name)")
        .order("month", { ascending: false });
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
        user_id: form.user_id || null,
        status: form.status,
        commission_rate: parseFloat(form.commission_rate) || 0,
        default_commission: parseFloat(form.default_commission) || 0,
        allow_all_packages: form.allow_all_packages,
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

  // Calculate and generate commissions for all resellers for a given month
  const generateCommissions = useMutation({
    mutationFn: async () => {
      if (!commissionMonth) throw new Error("Select a month");

      for (const r of resellers) {
        if (r.status !== "active") continue;
        const rate = parseFloat(r.commission_rate) || 0;
        if (rate <= 0) continue;

        // Get total billing of reseller's customers for this month
        const { data: custIds } = await (db as any)
          .from("customers")
          .select("id")
          .eq("reseller_id", r.id);

        if (!custIds || custIds.length === 0) continue;

        const ids = custIds.map((c: any) => c.id);
        const { data: bills } = await (db as any)
          .from("bills")
          .select("amount, paid_amount")
          .in("customer_id", ids)
          .eq("month", commissionMonth);

        const totalBilling = (bills || []).reduce((s: number, b: any) => s + (parseFloat(b.paid_amount) || 0), 0);
        const commissionAmount = (totalBilling * rate) / 100;

        if (totalBilling <= 0) continue;

        // Upsert commission record
        const { data: existing } = await (db as any)
          .from("reseller_commissions")
          .select("id")
          .eq("reseller_id", r.id)
          .eq("month", commissionMonth)
          .maybeSingle();

        if (existing) {
          await (db as any).from("reseller_commissions").update({
            total_billing: totalBilling,
            commission_rate: rate,
            commission_amount: commissionAmount,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await (db as any).from("reseller_commissions").insert({
            reseller_id: r.id,
            tenant_id: tenantId,
            month: commissionMonth,
            total_billing: totalBilling,
            commission_rate: rate,
            commission_amount: commissionAmount,
            status: "pending",
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(`Commissions calculated for ${commissionMonth}`);
      queryClient.invalidateQueries({ queryKey: ["reseller-commissions"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Pay a commission (add to reseller wallet)
  const payCommission = useMutation({
    mutationFn: async (comm: any) => {
      const r = resellers.find((rs: any) => rs.id === comm.reseller_id);
      if (!r) throw new Error("Reseller not found");

      const amount = parseFloat(comm.commission_amount);
      const newBalance = parseFloat(r.wallet_balance) + amount;

      await (db as any).from("reseller_wallet_transactions").insert({
        reseller_id: r.id,
        tenant_id: tenantId,
        type: "credit",
        amount,
        balance_after: newBalance,
        description: `Commission payout for ${comm.month}`,
      });

      await (db as any).from("resellers")
        .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", r.id);

      await (db as any).from("reseller_commissions")
        .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", comm.id);
    },
    onSuccess: () => {
      toast.success("Commission paid to wallet");
      queryClient.invalidateQueries({ queryKey: ["reseller-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      name: r.name, company_name: r.company_name || "", phone: r.phone || "",
      email: r.email || "", address: r.address || "", user_id: r.user_id || "", password: "",
      status: r.status, commission_rate: r.commission_rate?.toString() || "0",
      default_commission: r.default_commission?.toString() || "0",
      allow_all_packages: r.allow_all_packages || false,
    });
    setDialogOpen(true);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  const handleImpersonate = async (r: any) => {
    setImpersonating(true);
    try {
      const adminToken = sessionStorage.getItem("admin_token");
      if (!adminToken) { toast.error("Admin session not found"); return; }
      await signInAsImpersonation(r.id, adminToken);
      toast.success(`Logged in as reseller: ${r.name}`);
      navigate("/reseller/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Impersonation failed");
    } finally {
      setImpersonating(false);
    }
  };

  const filtered = resellers.filter((r: any) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.user_id?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Reseller Management</h1>
            <p className="text-muted-foreground mt-1">Manage resellers, wallets, and commissions</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-60" />
            </div>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Reseller</Button>
          </div>
        </div>

        <Tabs defaultValue="resellers">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="resellers"><Users className="h-4 w-4 mr-1.5" />Resellers</TabsTrigger>
            <TabsTrigger value="commissions"><Calculator className="h-4 w-4 mr-1.5" />Commissions</TabsTrigger>
          </TabsList>

          {/* Resellers Tab */}
          <TabsContent value="resellers" className="mt-4">
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
                          <TableHead>User ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Wallet</TableHead>
                          <TableHead>Commission (%)</TableHead>
                          <TableHead>Default Commission (৳)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">{r.user_id || "—"}</TableCell>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell>{r.company_name || "—"}</TableCell>
                            <TableCell>{r.phone || "—"}</TableCell>
                            <TableCell className="font-medium">৳{parseFloat(r.wallet_balance).toLocaleString()}</TableCell>
                            <TableCell>{r.commission_rate}%</TableCell>
                            <TableCell>৳{parseFloat(r.default_commission || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={r.status === "active" ? "default" : "destructive"}>{r.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {r.status === "active" && (
                                  <Button variant="outline" size="sm" onClick={() => handleImpersonate(r)} disabled={impersonating}>
                                    <LogIn className="h-3.5 w-3.5 mr-1" /> Login as Reseller
                                  </Button>
                                )}
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
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-end gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Label>Month</Label>
                    <Input type="month" value={commissionMonth} onChange={(e) => setCommissionMonth(e.target.value)} />
                  </div>
                  <Button onClick={() => generateCommissions.mutate()} disabled={generateCommissions.isPending}>
                    {generateCommissions.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Calculate Commissions
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This will calculate commission for all active resellers based on their customers' paid bills for the selected month.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Commission Records</CardTitle></CardHeader>
              <CardContent className="p-0">
                {loadingComm ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : commissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No commission records yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reseller</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead>Total Billing</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.resellers?.name || "—"}</TableCell>
                            <TableCell>{c.month}</TableCell>
                            <TableCell>৳{parseFloat(c.total_billing).toLocaleString()}</TableCell>
                            <TableCell>{c.commission_rate}%</TableCell>
                            <TableCell className="font-medium text-primary">৳{parseFloat(c.commission_amount).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === "paid" ? "default" : "secondary"}>
                                {c.status === "paid" ? "Paid" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {c.status === "pending" && (
                                <Button size="sm" variant="outline" onClick={() => {
                                  if (confirm(`Pay ৳${parseFloat(c.commission_amount).toLocaleString()} commission to wallet?`)) {
                                    payCommission.mutate(c);
                                  }
                                }} disabled={payCommission.isPending}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pay to Wallet
                                </Button>
                              )}
                              {c.status === "paid" && c.paid_at && (
                                <span className="text-xs text-muted-foreground">
                                  Paid {format(new Date(c.paid_at), "dd MMM yyyy")}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                <Label>User ID *</Label>
                <Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="Unique login ID" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default Commission (৳)</Label>
                <Input type="number" value={form.default_commission} onChange={(e) => setForm({ ...form, default_commission: e.target.value })} placeholder="Fixed amount per customer" />
                <p className="text-xs text-muted-foreground">Reseller keeps this amount as profit per customer activation</p>
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
            {/* Package Assignment Section — only for editing existing resellers */}
            {editId && tenantId && (
              <ResellerPackageAssign
                resellerId={editId}
                tenantId={tenantId}
                allowAllPackages={form.allow_all_packages}
                onAllowAllChange={(v) => setForm({ ...form, allow_all_packages: v })}
              />
            )}
            {/* Package-wise Commission Settings */}
            {editId && tenantId && (
              <ResellerPackageCommissions
                resellerId={editId}
                tenantId={tenantId}
                defaultCommission={parseFloat(form.default_commission) || 0}
              />
            )}
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

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
import { Loader2, Search, Users, Plus, Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CustomerForm {
  name: string;
  phone: string;
  area: string;
  email: string;
  address: string;
  package_id: string;
  monthly_bill: string;
  connection_status: string;
}

const emptyForm: CustomerForm = {
  name: "", phone: "", area: "", email: "", address: "",
  package_id: "", monthly_bill: "", connection_status: "offline",
};

export default function ResellerCustomers() {
  const { reseller } = useResellerAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const { data: packages = [] } = useQuery({
    queryKey: ["reseller-packages", reseller?.tenant_id],
    queryFn: async () => {
      const { data } = await (db as any).from("packages").select("id, name, price").eq("tenant_id", reseller!.tenant_id).eq("status", "active").order("name");
      return data || [];
    },
    enabled: !!reseller?.tenant_id,
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["reseller-customers", reseller?.id],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("customers")
        .select("id, customer_id, name, phone, area, monthly_bill, connection_status, status, package_id, email, packages(name, price)")
        .eq("reseller_id", reseller!.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  const { data: walletData } = useQuery({
    queryKey: ["reseller-wallet-quick", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any).from("resellers").select("wallet_balance").eq("id", reseller!.id).single();
      return data;
    },
    enabled: !!reseller?.id,
  });

  const generateCustomerId = () => {
    const prefix = reseller?.company_name?.slice(0, 2).toUpperCase() || "RS";
    return `${prefix}${Date.now().toString().slice(-6)}`;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.phone || !form.area) throw new Error("Name, phone and area are required");

      const selectedPkg = packages.find((p: any) => p.id === form.package_id);
      const monthlyBill = parseFloat(form.monthly_bill) || (selectedPkg ? parseFloat(selectedPkg.price) : 0);

      if (editId) {
        // Update existing customer
        const payload: any = {
          name: form.name,
          phone: form.phone,
          area: form.area,
          email: form.email || null,
          package_id: form.package_id || null,
          monthly_bill: monthlyBill,
          connection_status: form.connection_status,
          updated_at: new Date().toISOString(),
        };
        const { error } = await (db as any).from("customers").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        // Create new customer — deduct wallet
        const walletBalance = parseFloat(walletData?.wallet_balance) || 0;
        if (monthlyBill > 0 && walletBalance < monthlyBill) {
          throw new Error(`Insufficient wallet balance. Required: ৳${monthlyBill}, Available: ৳${walletBalance}`);
        }

        const customerId = generateCustomerId();
        const { error } = await (db as any).from("customers").insert({
          customer_id: customerId,
          name: form.name,
          phone: form.phone,
          area: form.area,
          email: form.email || null,
          package_id: form.package_id || null,
          monthly_bill: monthlyBill,
          connection_status: form.connection_status,
          reseller_id: reseller!.id,
          tenant_id: reseller!.tenant_id,
          status: "active",
        });
        if (error) throw error;

        // Deduct wallet balance
        if (monthlyBill > 0) {
          const newBalance = walletBalance - monthlyBill;
          await (db as any).from("reseller_wallet_transactions").insert({
            reseller_id: reseller!.id,
            tenant_id: reseller!.tenant_id,
            type: "debit",
            amount: monthlyBill,
            balance_after: newBalance,
            description: `Customer activation: ${form.name} (${customerId})`,
          });
          await (db as any).from("resellers").update({ wallet_balance: newBalance, updated_at: new Date().toISOString() }).eq("id", reseller!.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Customer updated" : "Customer created & wallet deducted");
      queryClient.invalidateQueries({ queryKey: ["reseller-customers"] });
      queryClient.invalidateQueries({ queryKey: ["reseller-wallet-quick"] });
      queryClient.invalidateQueries({ queryKey: ["reseller-dashboard"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name, phone: c.phone || "", area: c.area || "", email: c.email || "",
      address: "", package_id: c.package_id || "", monthly_bill: c.monthly_bill?.toString() || "",
      connection_status: c.connection_status || "offline",
    });
    setDialogOpen(true);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  const filtered = customers.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id?.includes(search) ||
    c.phone?.includes(search)
  );

  const walletBalance = parseFloat(walletData?.wallet_balance) || 0;

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> My Customers</h1>
            <p className="text-muted-foreground mt-1">
              {customers.length} customers · Wallet: <span className={walletBalance < 500 ? "text-destructive font-semibold" : "text-primary font-semibold"}>৳{walletBalance.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No customers found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Bill</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.customer_id}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{c.area}</TableCell>
                        <TableCell>{c.packages?.name || "—"}</TableCell>
                        <TableCell>৳{c.monthly_bill}</TableCell>
                        <TableCell>
                          <Badge variant={c.connection_status === "online" ? "default" : "secondary"}>{c.connection_status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
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
            <DialogTitle>{editId ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          {!editId && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Wallet balance: ৳{walletBalance.toLocaleString()} — First month bill will be deducted from wallet.
            </p>
          )}
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Area *</Label>
                <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Package</Label>
                <Select value={form.package_id} onValueChange={(v) => {
                  const pkg = packages.find((p: any) => p.id === v);
                  setForm({ ...form, package_id: v, monthly_bill: pkg?.price?.toString() || form.monthly_bill });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>
                    {packages.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Bill (৳)</Label>
                <Input type="number" value={form.monthly_bill} onChange={(e) => setForm({ ...form, monthly_bill: e.target.value })} placeholder="Auto from package" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Connection Status</Label>
              <Select value={form.connection_status} onValueChange={(v) => setForm({ ...form, connection_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editId ? "Update" : "Create & Deduct Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResellerLayout>
  );
}

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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Users, Plus, Edit, User, MapPin, Wifi, Receipt, Building } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useGeoDivisions, useGeoDistricts, useGeoUpazilas, useGeoDivisionByName, useGeoDistrictByName } from "@/hooks/useGeoData";

// --- Section wrapper ---
function FormSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface CustomerForm {
  name: string;
  father_name: string;
  mother_name: string;
  occupation: string;
  nid: string;
  phone: string;
  alt_phone: string;
  email: string;
  area: string;
  division: string;
  district: string;
  upazila: string;
  village: string;
  road: string;
  house: string;
  post_office: string;
  city: string;
  perm_division: string;
  perm_district: string;
  perm_upazila: string;
  perm_village: string;
  perm_road: string;
  perm_house: string;
  perm_post_office: string;
  package_id: string;
  monthly_bill: string;
  discount: string;
  due_date_day: string;
  connection_status: string;
  zone_id: string;
  installation_date: string;
  pop_location: string;
  installed_by: string;
  box_name: string;
  cable_length: string;
  is_free: boolean;
}

const emptyForm: CustomerForm = {
  name: "", father_name: "", mother_name: "", occupation: "", nid: "",
  phone: "", alt_phone: "", email: "",
  area: "", division: "", district: "", upazila: "",
  village: "", road: "", house: "", post_office: "", city: "",
  perm_division: "", perm_district: "", perm_upazila: "",
  perm_village: "", perm_road: "", perm_house: "", perm_post_office: "",
  package_id: "", monthly_bill: "", discount: "0", due_date_day: "",
  connection_status: "offline", zone_id: "",
  installation_date: "", pop_location: "", installed_by: "",
  box_name: "", cable_length: "", is_free: false,
};

function generatePPPoEUsername(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CUST-${ts.slice(-4)}${rand}`;
}

function generatePPPoEPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

export default function ResellerCustomers() {
  const { reseller } = useResellerAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [generatedPPPoE, setGeneratedPPPoE] = useState<{ username: string; password: string } | null>(null);

  // Geo cascading state
  const [divisionId, setDivisionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [permDivisionId, setPermDivisionId] = useState("");
  const [permDistrictId, setPermDistrictId] = useState("");

  const { data: geoDivisions } = useGeoDivisions();
  const { data: geoDistricts } = useGeoDistricts(divisionId || undefined);
  const { data: geoUpazilas } = useGeoUpazilas(districtId || undefined);
  const { data: permGeoDistricts } = useGeoDistricts(permDivisionId || undefined);
  const { data: permGeoUpazilas } = useGeoUpazilas(permDistrictId || undefined);

  const { data: foundDivision } = useGeoDivisionByName(editId && !divisionId ? form.division : undefined);
  const { data: foundDistrict } = useGeoDistrictByName(editId && !districtId ? form.district : undefined);
  const { data: foundPermDivision } = useGeoDivisionByName(editId && !permDivisionId ? form.perm_division : undefined);
  const { data: foundPermDistrict } = useGeoDistrictByName(editId && !permDistrictId ? form.perm_district : undefined);

  useEffect(() => { if (foundDivision?.id && !divisionId) setDivisionId(foundDivision.id); }, [foundDivision]);
  useEffect(() => { if (foundDistrict?.id && !districtId) setDistrictId(foundDistrict.id); }, [foundDistrict]);
  useEffect(() => { if (foundPermDivision?.id && !permDivisionId) setPermDivisionId(foundPermDivision.id); }, [foundPermDivision]);
  useEffect(() => { if (foundPermDistrict?.id && !permDistrictId) setPermDistrictId(foundPermDistrict.id); }, [foundPermDistrict]);

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Fetch reseller's allow_all_packages flag and default_commission
  const { data: resellerInfo } = useQuery({
    queryKey: ["reseller-info", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any).from("resellers").select("allow_all_packages, default_commission").eq("id", reseller!.id).single();
      return data;
    },
    enabled: !!reseller?.id,
  });

  // Fetch per-package commissions for this reseller
  const { data: packageCommissions = [] } = useQuery({
    queryKey: ["reseller-pkg-commissions", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any).from("reseller_package_commissions")
        .select("package_id, commission_amount")
        .eq("reseller_id", reseller!.id);
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  const allowAll = resellerInfo?.allow_all_packages ?? false;

  const { data: assignedPkgIds } = useQuery({
    queryKey: ["reseller-assigned-pkg-ids", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any).from("reseller_packages").select("package_id").eq("reseller_id", reseller!.id).eq("status", "active");
      return (data || []).map((r: any) => r.package_id) as string[];
    },
    enabled: !!reseller?.id && !allowAll,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["reseller-packages", reseller?.tenant_id, allowAll, assignedPkgIds],
    queryFn: async () => {
      let q = (db as any).from("packages").select("id, name, monthly_price").eq("tenant_id", reseller!.tenant_id).eq("is_active", true).order("name");
      if (!allowAll && assignedPkgIds && assignedPkgIds.length > 0) {
        q = q.in("id", assignedPkgIds);
      } else if (!allowAll) {
        return [];
      }
      const { data } = await q;
      return (data || []).map((p: any) => ({ ...p, price: p.monthly_price }));
    },
    enabled: !!reseller?.tenant_id && (allowAll || assignedPkgIds !== undefined),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["reseller-zones", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any)
        .from("reseller_zones")
        .select("id, name")
        .eq("reseller_id", reseller!.id)
        .eq("tenant_id", reseller!.tenant_id)
        .eq("status", "active")
        .order("name");
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["reseller-customers", reseller?.id, reseller?.tenant_id],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("customers")
        .select("id, customer_id, name, phone, area, monthly_bill, connection_status, status, package_id, email, zone_id, packages(name, monthly_price), reseller_zones(name)")
        .eq("reseller_id", reseller!.id)
        .eq("tenant_id", reseller!.tenant_id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!reseller?.id && !!reseller?.tenant_id,
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
      if (!selectedPkg) throw new Error("প্যাকেজ সিলেক্ট করুন");
      // Reseller cannot override monthly bill — always use package price
      const monthlyBill = parseFloat(selectedPkg.price) || 0;
      if (monthlyBill <= 0) throw new Error("প্যাকেজের মূল্য সঠিক নয়");

      const basePayload: any = {
        name: form.name,
        father_name: form.father_name || null,
        mother_name: form.mother_name || null,
        occupation: form.occupation || null,
        nid: form.nid || null,
        phone: form.phone,
        alt_phone: form.alt_phone || null,
        email: form.email || null,
        area: form.area,
        division: form.division || null,
        district: form.district || null,
        upazila: form.upazila || null,
        village: form.village || null,
        road: form.road || null,
        house: form.house || null,
        post_office: form.post_office || null,
        city: form.city || null,
        perm_division: form.perm_division || null,
        perm_district: form.perm_district || null,
        perm_upazila: form.perm_upazila || null,
        perm_village: form.perm_village || null,
        perm_road: form.perm_road || null,
        perm_house: form.perm_house || null,
        perm_post_office: form.perm_post_office || null,
        package_id: form.package_id || null,
        monthly_bill: monthlyBill,
        discount: 0, // Reseller cannot set discount
        due_date_day: form.due_date_day ? parseInt(form.due_date_day) : null,
        connection_status: form.connection_status,
        zone_id: form.zone_id || null,
        installation_date: form.installation_date || null,
        pop_location: form.pop_location || null,
        installed_by: form.installed_by || null,
        box_name: form.box_name || null,
        cable_length: form.cable_length || null,
      };

      if (editId) {
        const { error } = await (db as any).from("customers").update({
          ...basePayload,
          updated_at: new Date().toISOString(),
        }).eq("id", editId);
        if (error) throw error;
      } else {
        const walletBalance = parseFloat(walletData?.wallet_balance) || 0;
        if (monthlyBill > 0 && walletBalance < monthlyBill) {
          throw new Error(`Insufficient wallet balance. Required: ৳${monthlyBill}, Available: ৳${walletBalance}`);
        }

        const pppoeUsername = generatePPPoEUsername();
        const pppoePassword = generatePPPoEPassword();
        const customerId = generateCustomerId();

        const { error } = await (db as any).from("customers").insert({
          ...basePayload,
          customer_id: customerId,
          reseller_id: reseller!.id,
          tenant_id: reseller!.tenant_id,
          status: "active",
          pppoe_username: pppoeUsername,
          pppoe_password: pppoePassword,
        });
        if (error) throw error;

        setGeneratedPPPoE({ username: pppoeUsername, password: pppoePassword });

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
      if (editId) {
        setDialogOpen(false);
        setForm(emptyForm);
        setEditId(null);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (c: any) => {
    setEditId(c.id);
    setGeneratedPPPoE(null);
    setDivisionId("");
    setDistrictId("");
    setPermDivisionId("");
    setPermDistrictId("");

    // Fetch full customer data for edit
    (db as any).from("customers")
      .select("*")
      .eq("id", c.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setForm({
            name: data.name || "", father_name: data.father_name || "", mother_name: data.mother_name || "",
            occupation: data.occupation || "", nid: data.nid || "",
            phone: data.phone || "", alt_phone: data.alt_phone || "", email: data.email || "",
            area: data.area || "", division: data.division || "", district: data.district || "",
            upazila: data.upazila || "", village: data.village || "", road: data.road || "",
            house: data.house || "", post_office: data.post_office || "", city: data.city || "",
            perm_division: data.perm_division || "", perm_district: data.perm_district || "",
            perm_upazila: data.perm_upazila || "", perm_village: data.perm_village || "",
            perm_road: data.perm_road || "", perm_house: data.perm_house || "",
            perm_post_office: data.perm_post_office || "",
            package_id: data.package_id || "", monthly_bill: data.monthly_bill?.toString() || "",
            discount: data.discount?.toString() || "0",
            due_date_day: data.due_date_day?.toString() || "",
            connection_status: data.connection_status || "offline",
            zone_id: data.zone_id || "",
            installation_date: data.installation_date || "",
            pop_location: data.pop_location || "", installed_by: data.installed_by || "",
            box_name: data.box_name || "", cable_length: data.cable_length || "",
            is_free: Number(data.monthly_bill) === 0,
          });
        }
      });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditId(null);
    setGeneratedPPPoE(null);
    setDivisionId("");
    setDistrictId("");
    setPermDivisionId("");
    setPermDistrictId("");
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setGeneratedPPPoE(null);
  };

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
                      <TableHead>Zone</TableHead>
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
                        <TableCell>{c.reseller_zones?.name || "—"}</TableCell>
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
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>

          {/* Show generated PPPoE credentials after creation */}
          {generatedPPPoE && !editId && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg space-y-1">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">✅ Customer Created! PPPoE Credentials:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Username:</span>
                  <p className="font-mono font-semibold">{generatedPPPoE.username}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Password:</span>
                  <p className="font-mono font-semibold">{generatedPPPoE.password}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Save these credentials. Tenant admin will assign the MikroTik router.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={closeDialog}>Close</Button>
            </div>
          )}

          {!generatedPPPoE && (
            <>
              {!editId && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Wallet: ৳{walletBalance.toLocaleString()} — PPPoE credentials will be auto-generated.
                </p>
              )}

              <div className="space-y-4">
                {/* ─── Personal Information ─── */}
                <FormSection icon={User} title="Personal Information">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Applicant Name *</Label>
                      <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Father Name</Label>
                      <Input value={form.father_name} onChange={(e) => update("father_name", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mother Name</Label>
                      <Input value={form.mother_name} onChange={(e) => update("mother_name", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mobile *</Label>
                      <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alternative Contact</Label>
                      <Input value={form.alt_phone} onChange={(e) => update("alt_phone", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">National ID</Label>
                      <Input value={form.nid} onChange={(e) => update("nid", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Occupation</Label>
                      <Input value={form.occupation} onChange={(e) => update("occupation", e.target.value)} className="h-9" />
                    </div>
                  </div>
                </FormSection>

                {/* ─── Present Address ─── */}
                <FormSection icon={MapPin} title="Present Address">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Zone *</Label>
                      <Select value={form.zone_id} onValueChange={(v) => update("zone_id", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select zone" /></SelectTrigger>
                        <SelectContent>
                          {zones.map((z: any) => (
                            <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Area *</Label>
                      <Input value={form.area} onChange={(e) => update("area", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Division</Label>
                      <Select value={form.division} onValueChange={(v) => {
                        const div = geoDivisions?.find(d => d.name === v);
                        setDivisionId(div?.id || "");
                        setDistrictId("");
                        setForm(prev => ({ ...prev, division: v, district: "", upazila: "" }));
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select division" /></SelectTrigger>
                        <SelectContent>
                          {geoDivisions?.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">District</Label>
                      <Select value={form.district} onValueChange={(v) => {
                        const dist = geoDistricts?.find(d => d.name === v);
                        setDistrictId(dist?.id || "");
                        setForm(prev => ({ ...prev, district: v, upazila: "" }));
                      }} disabled={!form.division}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select district" /></SelectTrigger>
                        <SelectContent>
                          {(geoDistricts || []).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Upazila</Label>
                      <Select value={form.upazila} onValueChange={(v) => update("upazila", v)} disabled={!form.district}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select upazila" /></SelectTrigger>
                        <SelectContent>
                          {(geoUpazilas || []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Village</Label>
                      <Input value={form.village} onChange={(e) => update("village", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Road / Block</Label>
                      <Input value={form.road} onChange={(e) => update("road", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">House</Label>
                      <Input value={form.house} onChange={(e) => update("house", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Post Office</Label>
                      <Input value={form.post_office} onChange={(e) => update("post_office", e.target.value)} className="h-9" />
                    </div>
                  </div>
                </FormSection>

                {/* ─── Permanent Address ─── */}
                <FormSection icon={MapPin} title="Permanent Address">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Division</Label>
                      <Select value={form.perm_division} onValueChange={(v) => {
                        const div = geoDivisions?.find(d => d.name === v);
                        setPermDivisionId(div?.id || "");
                        setPermDistrictId("");
                        setForm(prev => ({ ...prev, perm_division: v, perm_district: "", perm_upazila: "" }));
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select division" /></SelectTrigger>
                        <SelectContent>
                          {geoDivisions?.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">District</Label>
                      <Select value={form.perm_district} onValueChange={(v) => {
                        const dist = permGeoDistricts?.find(d => d.name === v);
                        setPermDistrictId(dist?.id || "");
                        setForm(prev => ({ ...prev, perm_district: v, perm_upazila: "" }));
                      }} disabled={!form.perm_division}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select district" /></SelectTrigger>
                        <SelectContent>
                          {(permGeoDistricts || []).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Upazila</Label>
                      <Select value={form.perm_upazila} onValueChange={(v) => update("perm_upazila", v)} disabled={!form.perm_district}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select upazila" /></SelectTrigger>
                        <SelectContent>
                          {(permGeoUpazilas || []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Village</Label>
                      <Input value={form.perm_village} onChange={(e) => update("perm_village", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Road / Block</Label>
                      <Input value={form.perm_road} onChange={(e) => update("perm_road", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">House</Label>
                      <Input value={form.perm_house} onChange={(e) => update("perm_house", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Post Office</Label>
                      <Input value={form.perm_post_office} onChange={(e) => update("perm_post_office", e.target.value)} className="h-9" />
                    </div>
                  </div>
                </FormSection>

                {/* ─── Connection & Package ─── */}
                <FormSection icon={Wifi} title="Connection Details">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Package</Label>
                      <Select value={form.package_id} onValueChange={(v) => {
                        const pkg = packages.find((p: any) => p.id === v);
                        setForm(prev => ({ ...prev, package_id: v, monthly_bill: pkg?.price?.toString() || "0" }));
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select package" /></SelectTrigger>
                        <SelectContent>
                          {packages.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Connection Date</Label>
                      <Input type="date" value={form.installation_date} onChange={(e) => update("installation_date", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Connection Status</Label>
                      <Select value={form.connection_status} onValueChange={(v) => update("connection_status", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="offline">Offline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FormSection>

                {/* ─── Billing Information ─── */}
                <FormSection icon={Receipt} title="Billing Information">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Monthly Bill (৳)</Label>
                      <Input type="number" value={form.monthly_bill} className="h-9 bg-muted" disabled title="প্যাকেজ অনুযায়ী অটো সেট হয়" placeholder="Select a package" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount (৳)</Label>
                      <Input type="number" value="0" className="h-9 bg-muted" disabled title="রিসেলার ডিসকাউন্ট দিতে পারবেন না" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Due Date (Day)</Label>
                      <Select value={form.due_date_day} onValueChange={(v) => update("due_date_day", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select day" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FormSection>

                {/* ─── Office Use ─── */}
                <FormSection icon={Building} title="Office Use">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">POP Location</Label>
                      <Input value={form.pop_location} onChange={(e) => update("pop_location", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Installed By</Label>
                      <Input value={form.installed_by} onChange={(e) => update("installed_by", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Box Name</Label>
                      <Input value={form.box_name} onChange={(e) => update("box_name", e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cable Length</Label>
                      <Input value={form.cable_length} onChange={(e) => update("cable_length", e.target.value)} className="h-9" />
                    </div>
                  </div>
                </FormSection>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editId ? "Update" : "Create & Deduct Wallet"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ResellerLayout>
  );
}

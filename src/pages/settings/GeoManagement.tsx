import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Globe, Building, Map, Pencil, Check, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

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

// ─── Divisions Tab ───
function DivisionsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: divisions, isLoading } = useQuery({
    queryKey: ["geo-divisions-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("geo_divisions").select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["geo-divisions"] });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("geo_divisions").insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["geo-divisions-all"] }); setName(""); toast.success("Division added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("geo_divisions").update({ name: editName.trim() }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["geo-divisions-all"] }); setEditId(null); toast.success("Division updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("geo_divisions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["geo-divisions-all"] }); toast.success("Division deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Division name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs" />
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={!name.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-28">Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {divisions?.map((d: any) => (
            <TableRow key={d.id}>
              <TableCell>
                {editId === d.id ? (
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs" autoFocus />
                ) : d.name}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editId === d.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => editMutation.mutate()} disabled={!editName.trim()}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditId(null)}><X className="h-4 w-4 text-muted-foreground" /></Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditId(d.id); setEditName(d.name); }}><Pencil className="h-4 w-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && !divisions?.length && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No divisions</TableCell></TableRow>}
        </TableBody>
      </Table>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }} title="Delete Division" description="This will also delete all districts and upazilas under this division." />
    </div>
  );
}

// ─── Districts Tab ───
function DistrictsTab() {
  const qc = useQueryClient();
  const [divisionId, setDivisionId] = useState("");
  const [name, setName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: divisions } = useQuery({
    queryKey: ["geo-divisions-all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("geo_divisions").select("*").order("name");
      return data as any[];
    },
  });

  const { data: districts, isLoading } = useQuery({
    queryKey: ["geo-districts-all", divisionId],
    queryFn: async () => {
      let q = (supabase as any).from("geo_districts").select("*, geo_divisions(name)").order("name");
      if (divisionId) q = q.eq("division_id", divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["geo-districts"] }); qc.invalidateQueries({ queryKey: ["geo-districts-all"] }); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("geo_districts").insert({ name: name.trim(), division_id: divisionId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setName(""); toast.success("District added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("geo_districts").update({ name: editName.trim() }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditId(null); toast.success("District updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("geo_districts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("District deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={divisionId} onValueChange={setDivisionId}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Select Division" /></SelectTrigger>
          <SelectContent>{divisions?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="District name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs" />
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={!name.trim() || !divisionId}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>District</TableHead><TableHead>Division</TableHead><TableHead className="w-28">Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {districts?.map((d: any) => (
            <TableRow key={d.id}>
              <TableCell>
                {editId === d.id ? (
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs" autoFocus />
                ) : d.name}
              </TableCell>
              <TableCell><Badge variant="secondary">{d.geo_divisions?.name}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editId === d.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => editMutation.mutate()} disabled={!editName.trim()}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditId(null)}><X className="h-4 w-4 text-muted-foreground" /></Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditId(d.id); setEditName(d.name); }}><Pencil className="h-4 w-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && !districts?.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No districts</TableCell></TableRow>}
        </TableBody>
      </Table>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }} title="Delete District" description="This will also delete all upazilas under this district." />
    </div>
  );
}

// ─── Upazilas Tab ───
function UpazilasTab() {
  const qc = useQueryClient();
  const [divisionId, setDivisionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [name, setName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: divisions } = useQuery({
    queryKey: ["geo-divisions-all"],
    queryFn: async () => { const { data } = await (supabase as any).from("geo_divisions").select("*").order("name"); return data as any[]; },
  });

  const { data: districts } = useQuery({
    queryKey: ["geo-districts-filter", divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const { data } = await (supabase as any).from("geo_districts").select("*").eq("division_id", divisionId).order("name");
      return data as any[];
    },
    enabled: !!divisionId,
  });

  const { data: upazilas, isLoading } = useQuery({
    queryKey: ["geo-upazilas-all", districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const { data, error } = await (supabase as any).from("geo_upazilas").select("*, geo_districts(name)").eq("district_id", districtId).order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!districtId,
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["geo-upazilas"] }); qc.invalidateQueries({ queryKey: ["geo-upazilas-all"] }); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("geo_upazilas").insert({ name: name.trim(), district_id: districtId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setName(""); toast.success("Upazila added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("geo_upazilas").update({ name: editName.trim() }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditId(null); toast.success("Upazila updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("geo_upazilas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Upazila deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={divisionId} onValueChange={(v) => { setDivisionId(v); setDistrictId(""); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Division" /></SelectTrigger>
          <SelectContent>{divisions?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={districtId} onValueChange={setDistrictId} disabled={!divisionId}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="District" /></SelectTrigger>
          <SelectContent>{districts?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Upazila name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs" />
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={!name.trim() || !districtId}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Upazila</TableHead><TableHead>District</TableHead><TableHead className="w-28">Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {upazilas?.map((u: any) => (
            <TableRow key={u.id}>
              <TableCell>
                {editId === u.id ? (
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs" autoFocus />
                ) : u.name}
              </TableCell>
              <TableCell><Badge variant="secondary">{u.geo_districts?.name}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editId === u.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => editMutation.mutate()} disabled={!editName.trim()}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditId(null)}><X className="h-4 w-4 text-muted-foreground" /></Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditId(u.id); setEditName(u.name); }}><Pencil className="h-4 w-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && districtId && !upazilas?.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No upazilas</TableCell></TableRow>}
          {!districtId && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Select a division and district</TableCell></TableRow>}
        </TableBody>
      </Table>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }} title="Delete Upazila" />
    </div>
  );
}

// ─── Zones Tab ───
function ZonesTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const { data: zones, isLoading } = useQuery({
    queryKey: ["zones-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("*").order("area_name");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["zones"] }); qc.invalidateQueries({ queryKey: ["zones-all"] }); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("zones").insert({ area_name: name.trim(), address: address.trim() || null } as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setName(""); setAddress(""); toast.success("Zone added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("zones").update({ area_name: editName.trim(), address: editAddress.trim() || null } as any).eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditId(null); toast.success("Zone updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Zone deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Zone/Area name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs" />
        <Input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} className="h-9 max-w-xs" />
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={!name.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Zone / Area</TableHead><TableHead>Address</TableHead><TableHead>Status</TableHead><TableHead className="w-28">Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {zones?.map((z) => (
            <TableRow key={z.id}>
              <TableCell className="font-medium">
                {editId === z.id ? (
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs" autoFocus />
                ) : z.area_name}
              </TableCell>
              <TableCell>
                {editId === z.id ? (
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="h-8 max-w-xs" />
                ) : (z.address || "-")}
              </TableCell>
              <TableCell><Badge variant={z.status === "active" ? "default" : "secondary"}>{z.status}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editId === z.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => editMutation.mutate()} disabled={!editName.trim()}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditId(null)}><X className="h-4 w-4 text-muted-foreground" /></Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditId(z.id); setEditName(z.area_name); setEditAddress(z.address || ""); }}><Pencil className="h-4 w-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(z.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && !zones?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No zones</TableCell></TableRow>}
        </TableBody>
      </Table>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }} title="Delete Zone" />
    </div>
  );
}

// ─── Main Page ───
export default function GeoManagement() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Location Management</h1>
          <p className="text-muted-foreground text-sm">Manage divisions, districts, upazilas, and zones</p>
        </div>

        <Tabs defaultValue="divisions" className="w-full">
          <TabsList>
            <TabsTrigger value="divisions"><Globe className="h-4 w-4 mr-1.5" /> Divisions</TabsTrigger>
            <TabsTrigger value="districts"><Building className="h-4 w-4 mr-1.5" /> Districts</TabsTrigger>
            <TabsTrigger value="upazilas"><Map className="h-4 w-4 mr-1.5" /> Upazilas</TabsTrigger>
            <TabsTrigger value="zones"><MapPin className="h-4 w-4 mr-1.5" /> Zones</TabsTrigger>
          </TabsList>
          <TabsContent value="divisions"><FormSection icon={Globe} title="Divisions"><DivisionsTab /></FormSection></TabsContent>
          <TabsContent value="districts"><FormSection icon={Building} title="Districts"><DistrictsTab /></FormSection></TabsContent>
          <TabsContent value="upazilas"><FormSection icon={Map} title="Upazilas"><UpazilasTab /></FormSection></TabsContent>
          <TabsContent value="zones"><FormSection icon={MapPin} title="Zones"><ZonesTab /></FormSection></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

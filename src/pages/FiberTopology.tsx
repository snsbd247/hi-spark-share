import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Network, Plus, Search, ChevronRight, ChevronDown, Server, Cable, Cpu,
  GitBranch, Radio, User, Activity, Layers, CircleDot, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────
interface FiberCustomer { id: string; name: string; customer_id: string; }
interface FiberOnuData { id: string; serial_number: string; mac_address: string; status: string; customer_id: string; customer?: FiberCustomer; }
interface SplitterOutput { id: string; output_number: number; status: string; onu?: FiberOnuData; }
interface Splitter { id: string; ratio: string; location: string; label: string; status: string; outputs: SplitterOutput[]; }
interface FiberCoreData { id: string; core_number: number; color: string; status: string; splitter?: Splitter; }
interface FiberCableData { id: string; name: string; total_cores: number; color: string; length_meters: number; status: string; cores: FiberCoreData[]; }
interface PonPort { id: string; port_number: number; status: string; cables: FiberCableData[]; }
interface OltData { id: string; name: string; location: string; total_pon_ports: number; status: string; pon_ports: PonPort[]; }
interface Stats { total_olts: number; total_cables: number; total_cores: number; free_cores: number; used_cores: number; total_splitters: number; total_outputs: number; free_outputs: number; used_outputs: number; total_onus: number; }

// ─── API calls ──────────────────────────
const fetchTree = async (): Promise<OltData[]> => {
  const { data } = await api.get("/api/fiber-topology/tree");
  return Array.isArray(data) ? data : [];
};
const fetchStats = async (): Promise<Stats> => {
  const { data } = await api.get("/api/fiber-topology/stats");
  return data;
};
const searchTopology = async (q: string) => {
  const { data } = await api.get(`/api/fiber-topology/search?q=${q}`);
  return data;
};

// ─── Tree Node Component ──────────────
function TreeNode({ label, icon: Icon, iconColor, badge, badgeVariant, children, level = 0, defaultOpen = false }: {
  label: string; icon: any; iconColor?: string; badge?: string; badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  children?: React.ReactNode; level?: number; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div className={cn("select-none", level > 0 && "ml-4 border-l border-border/40 pl-2")}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 group",
          open && hasChildren && "bg-accent/30"
        )}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <div className="w-3.5" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0", iconColor || "text-primary")} />
        <span className="text-sm font-medium text-foreground truncate">{label}</span>
        {badge && <Badge variant={badgeVariant || "secondary"} className="text-[10px] px-1.5 py-0 h-5 ml-auto">{badge}</Badge>}
      </div>
      {open && hasChildren && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

// ─── Stat Card ────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────
export default function FiberTopology() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dialogType, setDialogType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Queries
  const { data: tree = [], isLoading: treeLoading } = useQuery({ queryKey: ["fiber-tree"], queryFn: fetchTree });
  const { data: stats } = useQuery({ queryKey: ["fiber-stats"], queryFn: fetchStats });

  // Search
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length >= 2) {
      const results = await searchTopology(q);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, []);

  // Mutations
  const createOlt = useMutation({
    mutationFn: (data: any) => api.post("/api/fiber-topology/olts", data),
    onSuccess: () => { toast.success("OLT তৈরি হয়েছে"); queryClient.invalidateQueries({ queryKey: ["fiber-tree"] }); queryClient.invalidateQueries({ queryKey: ["fiber-stats"] }); setDialogType(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "ত্রুটি হয়েছে"),
  });

  const createCable = useMutation({
    mutationFn: (data: any) => api.post("/api/fiber-topology/cables", data),
    onSuccess: () => { toast.success("ফাইবার ক্যাবল তৈরি হয়েছে"); queryClient.invalidateQueries({ queryKey: ["fiber-tree"] }); queryClient.invalidateQueries({ queryKey: ["fiber-stats"] }); setDialogType(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "ত্রুটি হয়েছে"),
  });

  const createSplitter = useMutation({
    mutationFn: (data: any) => api.post("/api/fiber-topology/splitters", data),
    onSuccess: () => { toast.success("স্প্লিটার তৈরি হয়েছে"); queryClient.invalidateQueries({ queryKey: ["fiber-tree"] }); queryClient.invalidateQueries({ queryKey: ["fiber-stats"] }); setDialogType(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "ত্রুটি হয়েছে"),
  });

  const createOnu = useMutation({
    mutationFn: (data: any) => api.post("/api/fiber-topology/onus", data),
    onSuccess: () => { toast.success("ONU অ্যাসাইন হয়েছে"); queryClient.invalidateQueries({ queryKey: ["fiber-tree"] }); queryClient.invalidateQueries({ queryKey: ["fiber-stats"] }); setDialogType(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "ত্রুটি হয়েছে"),
  });

  const safeTree = Array.isArray(tree) ? tree : [];
  // All PON ports for cable assignment
  const allPonPorts = safeTree.flatMap(olt => (olt.pon_ports || []).map(p => ({ ...p, oltName: olt.name })));
  // All free cores for splitter assignment
  const allFreeCores = safeTree.flatMap(olt =>
    (olt.pon_ports || []).flatMap(pp =>
      (pp.cables || []).flatMap(cable =>
        (cable.cores || []).filter(c => c.status === "free").map(c => ({ ...c, cableName: cable.name, oltName: olt.name }))
      )
    )
  );
  // All free outputs for ONU assignment
  const allFreeOutputs = safeTree.flatMap(olt =>
    (olt.pon_ports || []).flatMap(pp =>
      (pp.cables || []).flatMap(cable =>
        (cable.cores || []).flatMap(core =>
          (core.splitter?.outputs || []).filter(o => o.status === "free").map(o => ({
            ...o, splitterRatio: core.splitter?.ratio, coreNumber: core.core_number, cableName: cable.name,
          }))
        )
      )
    )
  );

  const handleSubmit = () => {
    switch (dialogType) {
      case "olt": createOlt.mutate(formData); break;
      case "cable": createCable.mutate(formData); break;
      case "splitter": createSplitter.mutate(formData); break;
      case "onu": createOnu.mutate(formData); break;
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="নেটওয়ার্ক টপোলজি"
        description="OLT → PON → Fiber → Core → Splitter → ONU → Customer"
        icon={<Network className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setFormData({ total_pon_ports: 8 }); setDialogType("olt"); }}>
              <Plus className="h-4 w-4 mr-1" /> OLT
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({ total_cores: 12 }); setDialogType("cable"); }}>
              <Plus className="h-4 w-4 mr-1" /> ক্যাবল
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({ ratio: "1:8" }); setDialogType("splitter"); }}>
              <Plus className="h-4 w-4 mr-1" /> স্প্লিটার
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({}); setDialogType("onu"); }}>
              <Plus className="h-4 w-4 mr-1" /> ONU
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="মোট OLT" value={stats.total_olts} icon={Server} color="bg-primary" />
          <StatCard label="মোট ক্যাবল" value={stats.total_cables} icon={Cable} color="bg-blue-600" />
          <StatCard label="ফ্রি কোর" value={stats.free_cores} icon={CircleDot} color="bg-emerald-600" />
          <StatCard label="স্প্লিটার" value={stats.total_splitters} icon={GitBranch} color="bg-amber-600" />
          <StatCard label="মোট ONU" value={stats.total_onus} icon={Radio} color="bg-violet-600" />
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="OLT, ক্যাবল, ONU সিরিয়াল দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg divide-y">
              {searchResults.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                  <span className="text-foreground">{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tree View */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            নেটওয়ার্ক হায়ারার্কি
          </CardTitle>
        </CardHeader>
        <CardContent>
          {treeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : safeTree.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">কোন OLT পাওয়া যায়নি। প্রথমে একটি OLT তৈরি করুন।</p>
            </div>
          ) : (
            <div className="space-y-1">
              {safeTree.map(olt => (
                <TreeNode key={olt.id} label={`${olt.name} ${olt.location ? `(${olt.location})` : ""}`} icon={Server} iconColor="text-red-500" badge={`${olt.total_pon_ports} পোর্ট`} defaultOpen>
                  {(olt.pon_ports || []).map(pp => (
                    <TreeNode key={pp.id} label={`PON Port ${pp.port_number}`} icon={Hash} iconColor="text-orange-500" badge={`${(pp.cables || []).length} ক্যাবল`} level={1}>
                      {(pp.cables || []).map(cable => (
                        <TreeNode key={cable.id} label={`${cable.name} (${cable.total_cores} কোর)`} icon={Cable} iconColor="text-blue-500" badge={`${(cable.cores || []).filter(c => c.status === "free").length} ফ্রি`} level={2}>
                          {(cable.cores || []).map(core => (
                            <TreeNode
                              key={core.id}
                              label={`কোর ${core.core_number}`}
                              icon={CircleDot}
                              iconColor={core.status === "free" ? "text-emerald-500" : "text-rose-500"}
                              badge={core.status === "free" ? "ফ্রি" : "ব্যবহৃত"}
                              badgeVariant={core.status === "free" ? "secondary" : "destructive"}
                              level={3}
                            >
                              {core.splitter && (
                                <TreeNode key={core.splitter.id} label={`স্প্লিটার (${core.splitter.ratio})`} icon={GitBranch} iconColor="text-amber-500" badge={`${(core.splitter.outputs || []).filter(o => o.status === "free").length} ফ্রি`} level={4}>
                                  {(core.splitter.outputs || []).map(output => (
                                    <TreeNode
                                      key={output.id}
                                      label={output.onu
                                        ? `আউটপুট ${output.output_number} → ${output.onu.serial_number} → ${output.onu.customer?.name || "N/A"}`
                                        : `আউটপুট ${output.output_number}`}
                                      icon={output.onu ? Radio : Cpu}
                                      iconColor={output.onu ? "text-violet-500" : "text-muted-foreground"}
                                      badge={output.status === "free" ? "ফ্রি" : "ব্যবহৃত"}
                                      badgeVariant={output.status === "free" ? "secondary" : "default"}
                                      level={5}
                                    >
                                      {output.onu?.customer && (
                                        <TreeNode
                                          label={`${output.onu.customer.name} (${output.onu.customer.customer_id})`}
                                          icon={User}
                                          iconColor="text-green-500"
                                          level={6}
                                        />
                                      )}
                                    </TreeNode>
                                  ))}
                                </TreeNode>
                              )}
                            </TreeNode>
                          ))}
                        </TreeNode>
                      ))}
                    </TreeNode>
                  ))}
                </TreeNode>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialogs ─────────────────────────────────── */}

      {/* OLT Dialog */}
      <Dialog open={dialogType === "olt"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>নতুন OLT তৈরি</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>নাম *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="OLT-1" /></div>
            <div><Label>লোকেশন</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Main POP" /></div>
            <div><Label>PON পোর্ট সংখ্যা *</Label><Input type="number" value={formData.total_pon_ports || 8} onChange={e => setFormData({ ...formData, total_pon_ports: parseInt(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createOlt.isPending}>{createOlt.isPending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cable Dialog */}
      <Dialog open={dialogType === "cable"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>নতুন ফাইবার ক্যাবল</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>নাম *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Fiber-001" /></div>
            <div>
              <Label>PON পোর্ট</Label>
              <Select value={formData.pon_port_id || ""} onValueChange={v => setFormData({ ...formData, pon_port_id: v })}>
                <SelectTrigger><SelectValue placeholder="পোর্ট সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {allPonPorts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.oltName} → Port {p.port_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>কোর সংখ্যা *</Label><Input type="number" value={formData.total_cores || 12} onChange={e => setFormData({ ...formData, total_cores: parseInt(e.target.value) })} /></div>
            <div><Label>রং</Label><Input value={formData.color || ""} onChange={e => setFormData({ ...formData, color: e.target.value })} placeholder="কালো" /></div>
            <div><Label>দৈর্ঘ্য (মিটার)</Label><Input type="number" value={formData.length_meters || ""} onChange={e => setFormData({ ...formData, length_meters: parseFloat(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createCable.isPending}>{createCable.isPending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Splitter Dialog */}
      <Dialog open={dialogType === "splitter"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>নতুন স্প্লিটার</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ফ্রি কোর *</Label>
              <Select value={formData.core_id || ""} onValueChange={v => setFormData({ ...formData, core_id: v })}>
                <SelectTrigger><SelectValue placeholder="কোর সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {allFreeCores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.oltName} → {c.cableName} → কোর {c.core_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>রেশিও *</Label>
              <Select value={formData.ratio || "1:8"} onValueChange={v => setFormData({ ...formData, ratio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1:2", "1:4", "1:8", "1:16", "1:32"].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>লোকেশন</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div><Label>লেবেল</Label><Input value={formData.label || ""} onChange={e => setFormData({ ...formData, label: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createSplitter.isPending}>{createSplitter.isPending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ONU Dialog */}
      <Dialog open={dialogType === "onu"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>ONU অ্যাসাইন করুন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ফ্রি আউটপুট *</Label>
              <Select value={formData.splitter_output_id || ""} onValueChange={v => setFormData({ ...formData, splitter_output_id: v })}>
                <SelectTrigger><SelectValue placeholder="আউটপুট সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {allFreeOutputs.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.cableName} → কোর {o.coreNumber} → স্প্লিটার ({o.splitterRatio}) → আউটপুট {o.output_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>সিরিয়াল নম্বর *</Label><Input value={formData.serial_number || ""} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} placeholder="HWTC-XXXX" /></div>
            <div><Label>MAC Address</Label><Input value={formData.mac_address || ""} onChange={e => setFormData({ ...formData, mac_address: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" /></div>
            <div><Label>কাস্টমার ID</Label><Input value={formData.customer_id || ""} onChange={e => setFormData({ ...formData, customer_id: e.target.value })} placeholder="UUID" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createOnu.isPending}>{createOnu.isPending ? "অ্যাসাইন হচ্ছে..." : "অ্যাসাইন করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

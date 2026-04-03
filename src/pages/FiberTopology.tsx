import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";
import { IS_LOVABLE } from "@/lib/environment";
import {
  Network, Plus, Search, ChevronRight, ChevronDown, Server, Cable, Cpu,
  GitBranch, Radio, User, Activity, Layers, CircleDot, Hash, MapPin,
  Link2, Unlink, Palette, TreePine, Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import {
  buildFiberMapMarkersFromTree,
  buildFiberStatsFromTree,
  collectAllFreeOutputs,
  createFiberCableInSupabase,
  createFiberOnuInSupabase,
  createFiberOltInSupabase,
  createFiberSpliceInSupabase,
  createFiberSplitterInSupabase,
  EMPTY_FIBER_STATS,
  fetchFiberSpliceCountFromSupabase,
  fetchFiberTopologyTreeFromSupabase,
  searchFiberTopologyTree,
  unwrapApiArray,
  unwrapApiObject,
  type FiberCableData,
  type FiberCoreData,
  type FiberMapMarker,
  type FiberOnuData,
  type FreeOutputItem,
  type OltData,
  type PonPort,
  type Splitter,
  type SplitterOutput,
  type Stats,
} from "@/lib/fiberTopology";

// ─── Fiber Color Constants ─────────────
const FIBER_COLORS: Record<string, string> = {
  Blue: "bg-blue-500", Orange: "bg-orange-500", Green: "bg-green-500", Brown: "bg-amber-700",
  Slate: "bg-slate-400", White: "bg-white border border-border", Red: "bg-red-500", Black: "bg-gray-900",
  Yellow: "bg-yellow-400", Violet: "bg-violet-500", Rose: "bg-rose-500", Aqua: "bg-cyan-400",
};
const COLOR_LIST = Object.keys(FIBER_COLORS);

function ColorDot({ color }: { color?: string }) {
  const cls = color ? FIBER_COLORS[color] || "bg-muted" : "bg-muted";
  return <span className={cn("inline-block h-3 w-3 rounded-full shrink-0", cls)} title={color || "N/A"} />;
}

// ─── API ──────────────────────────
const fetchTree = async (): Promise<OltData[]> => {
  if (IS_LOVABLE) return fetchFiberTopologyTreeFromSupabase();
  const { data } = await api.get("/fiber-topology/tree");
  return unwrapApiArray<OltData>(data);
};

const fetchStats = async (): Promise<Stats> => {
  const { data } = await api.get("/fiber-topology/stats");
  return unwrapApiObject<Stats>(data, EMPTY_FIBER_STATS);
};

const searchTopology = async (q: string) => {
  const { data } = await api.get(`/fiber-topology/search?q=${q}`);
  return unwrapApiArray<any>(data);
};

const fetchMapData = async () => {
  const { data } = await api.get("/fiber-topology/map-data");
  return unwrapApiArray<FiberMapMarker>(data);
};

const normalizeFiberTree = (data: unknown): OltData[] => (Array.isArray(data) ? (data as OltData[]) : []);

// ─── Tree Node ──────────────
function TreeNode({ label, icon: Icon, iconColor, badge, badgeVariant, children, level = 0, defaultOpen = false, extra }: {
  label: string; icon: any; iconColor?: string; badge?: string; badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  children?: React.ReactNode; level?: number; defaultOpen?: boolean; extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;
  return (
    <div className={cn("select-none", level > 0 && "ml-4 border-l border-border/40 pl-2")}>
      <div
        className={cn("flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 group", open && hasChildren && "bg-accent/30")}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : <div className="w-3.5" />}
        <Icon className={cn("h-4 w-4 shrink-0", iconColor || "text-primary")} />
        <span className="text-sm font-medium text-foreground truncate">{label}</span>
        {extra}
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

// ─── Map Component (Leaflet) ────────────
function TopologyMap({ markers }: { markers: any[] }) {
  const [MapComponents, setMapComponents] = useState<any>(null);

  useState(() => {
    import("react-leaflet").then((mod) => {
      import("leaflet").then((L) => {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
        setMapComponents({ MapContainer: mod.MapContainer, TileLayer: mod.TileLayer, Marker: mod.Marker, Popup: mod.Popup, L });
      });
    });
  });

  if (!MapComponents) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <Activity className="h-6 w-6 animate-spin mr-2" /> ম্যাপ লোড হচ্ছে...
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, L } = MapComponents;
  const center = markers.length > 0 ? [markers[0].lat, markers[0].lng] : [23.8103, 90.4125];

  const oltIcon = new L.Icon({
    iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });
  const splitterIcon = new L.Icon({
    iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-green.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });

  return (
    <div className="h-[400px] rounded-lg overflow-hidden border border-border">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
        {markers.map((m: any) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={m.type === "olt" ? oltIcon : splitterIcon}>
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{m.name}</div>
                <div className="text-muted-foreground capitalize">{m.type}</div>
                {m.cable && <div className="text-xs">Cable: {m.cable}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// ─── Recursive Splitter Tree Renderer ──────────────
function SplitterTreeNode({ splitter, level }: { splitter: Splitter; level: number }) {
  return (
    <TreeNode
      key={splitter.id}
      label={`স্প্লিটার (${splitter.ratio})${splitter.label ? ` - ${splitter.label}` : ""}${splitter.source_type === "splitter_output" ? " 🔗" : ""}`}
      icon={GitBranch} iconColor="text-amber-500"
      extra={splitter.lat ? <MapPin className="h-3 w-3 text-muted-foreground" /> : undefined}
      badge={`${(splitter.outputs || []).filter((o) => o.status === "free").length} ফ্রি`}
      level={level}
    >
      {(splitter.outputs || []).map((output) => (
        <OutputTreeNode key={output.id} output={output} level={level + 1} />
      ))}
    </TreeNode>
  );
}

function OutputTreeNode({ output, level }: { output: SplitterOutput; level: number }) {
  const hasChildren = !!(output.onu || output.child_cables?.length || output.child_splitter);
  const connectionLabel = output.connection_type === "fiber" ? " → 📡 ফাইবার"
    : output.connection_type === "splitter" ? " → 🔀 স্প্লিটার"
    : output.connection_type === "onu" ? ` → ${output.onu?.serial_number || "ONU"}`
    : "";

  return (
    <TreeNode
      label={`আউটপুট ${output.output_number}${connectionLabel}`}
      icon={output.onu ? Radio : output.connection_type === "fiber" ? Cable : output.connection_type === "splitter" ? GitBranch : Cpu}
      iconColor={output.onu ? "text-violet-500" : output.connection_type ? "text-blue-500" : "text-muted-foreground"}
      extra={<ColorDot color={output.color} />}
      badge={output.status === "free" ? "ফ্রি" : "ব্যবহৃত"}
      badgeVariant={output.status === "free" ? "secondary" : "default"}
      level={level}
    >
      {output.onu?.customer && (
        <TreeNode
          label={`${output.onu.customer.name} (${output.onu.customer.customer_id})`}
          icon={User} iconColor="text-green-500" level={level + 1}
        />
      )}
      {output.child_cables?.map((cable) => (
        <CableTreeNode key={cable.id} cable={cable} level={level + 1} />
      ))}
      {output.child_splitter && (
        <SplitterTreeNode splitter={output.child_splitter} level={level + 1} />
      )}
    </TreeNode>
  );
}

function CableTreeNode({ cable, level }: { cable: FiberCableData; level: number }) {
  return (
    <TreeNode
      label={`${cable.name} (${cable.total_cores} কোর)${cable.source_type === "splitter" ? " 🔗" : ""}`}
      icon={Cable} iconColor="text-blue-500"
      badge={`${(cable.cores || []).filter((c) => c.status === "free").length} ফ্রি`}
      level={level}
    >
      {(cable.cores || []).map((core) => (
        <CoreTreeNode key={core.id} core={core} level={level + 1} />
      ))}
    </TreeNode>
  );
}

function CoreTreeNode({ core, level }: { core: FiberCoreData; level: number }) {
  return (
    <TreeNode
      label={`কোর ${core.core_number}`}
      icon={CircleDot}
      iconColor={core.status === "free" ? "text-emerald-500" : "text-rose-500"}
      extra={<ColorDot color={core.color} />}
      badge={core.status === "free" ? "ফ্রি" : "ব্যবহৃত"}
      badgeVariant={core.status === "free" ? "secondary" : "destructive"}
      level={level}
    >
      {core.splitter && <SplitterTreeNode splitter={core.splitter} level={level + 1} />}
    </TreeNode>
  );
}

// ─── Main Page ────────────────────────
export default function FiberTopology() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dialogType, setDialogType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("tree");

  const { data: tree = [], isLoading: treeLoading } = useQuery({ queryKey: ["fiber-tree"], queryFn: fetchTree });
  const safeTree = useMemo(() => normalizeFiberTree(tree), [tree]);

  const { data: serverStats } = useQuery({ queryKey: ["fiber-stats"], queryFn: fetchStats, enabled: !IS_LOVABLE });
  const { data: spliceCount = 0 } = useQuery({ queryKey: ["fiber-splice-count"], queryFn: fetchFiberSpliceCountFromSupabase, enabled: IS_LOVABLE });
  const { data: fetchedMapMarkers = [] } = useQuery({ queryKey: ["fiber-map"], queryFn: fetchMapData, enabled: !IS_LOVABLE && activeTab === "map" });

  const stats = useMemo(
    () => (IS_LOVABLE ? buildFiberStatsFromTree(safeTree, spliceCount) : serverStats),
    [safeTree, serverStats, spliceCount],
  );

  const mapMarkers = useMemo<FiberMapMarker[]>(
    () => (IS_LOVABLE ? buildFiberMapMarkersFromTree(safeTree) : fetchedMapMarkers),
    [fetchedMapMarkers, safeTree],
  );

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length >= 2) {
      if (IS_LOVABLE) {
        setSearchResults(searchFiberTopologyTree(safeTree, q));
        return;
      }
      const results = await searchTopology(q);
      setSearchResults(Array.isArray(results) ? results : []);
    } else {
      setSearchResults([]);
    }
  }, [safeTree]);

  const invalidateAll = useCallback(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["fiber-tree"] }),
    queryClient.invalidateQueries({ queryKey: ["fiber-stats"] }),
    queryClient.invalidateQueries({ queryKey: ["fiber-map"] }),
    queryClient.invalidateQueries({ queryKey: ["fiber-splice-count"] }),
  ]), [queryClient]);

  const injectCreatedOltIntoTree = useCallback((payload: any) => {
    const createdOlt = payload?.data ?? payload;
    if (!createdOlt?.id) return;
    queryClient.setQueryData<OltData[]>(["fiber-tree"], (current) => {
      const safeCurrent = normalizeFiberTree(current);
      return [createdOlt as OltData, ...safeCurrent.filter((olt) => olt.id !== createdOlt.id)];
    });
  }, [queryClient]);

  const createOlt = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberOltInSupabase(data);
      const response = await api.post("/fiber-topology/olts", data);
      return response.data ?? response;
    },
    onSuccess: async (createdOlt) => { injectCreatedOltIntoTree(createdOlt); await invalidateAll(); toast.success("OLT তৈরি হয়েছে"); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.message || "ত্রুটি"),
  });

  const createCable = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberCableInSupabase(data);
      const response = await api.post("/fiber-topology/cables", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("ক্যাবল তৈরি হয়েছে"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || "ত্রুটি"),
  });

  const createSplitter = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberSplitterInSupabase(data);
      const response = await api.post("/fiber-topology/splitters", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("স্প্লিটার তৈরি হয়েছে"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || "ত্রুটি"),
  });

  const createOnu = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberOnuInSupabase(data);
      const response = await api.post("/fiber-topology/onus", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("ONU অ্যাসাইন হয়েছে"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || "ত্রুটি"),
  });

  const createSplice = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberSpliceInSupabase(data);
      const response = await api.post("/fiber-topology/splices", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("স্প্লাইস তৈরি হয়েছে"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || "ত্রুটি"),
  });

  const allPonPorts = useMemo(() =>
    safeTree.flatMap(olt => (olt.pon_ports || []).map(p => ({ ...p, oltName: olt.name }))),
    [safeTree]
  );

  // Collect all cores recursively
  const allCores = useMemo(() => {
    const cores: Array<FiberCoreData & { cableName: string; oltName: string }> = [];
    function walkCables(cables: FiberCableData[], oltName: string) {
      cables.forEach((cable) => {
        cable.cores.forEach((c) => {
          cores.push({ ...c, cableName: cable.name, oltName });
          if (c.splitter) walkSplitter(c.splitter, oltName);
        });
      });
    }
    function walkSplitter(splitter: Splitter, oltName: string) {
      splitter.outputs.forEach((o) => {
        if (o.child_cables) walkCables(o.child_cables, oltName);
        if (o.child_splitter) walkSplitter(o.child_splitter, oltName);
      });
    }
    safeTree.forEach((olt) => olt.pon_ports.forEach((pp) => walkCables(pp.cables, olt.name)));
    return cores;
  }, [safeTree]);

  const allFreeCores = useMemo(() => allCores.filter(c => c.status === "free"), [allCores]);

  // Collect all free outputs recursively
  const allFreeOutputs = useMemo(() => collectAllFreeOutputs(safeTree), [safeTree]);

  // Cable source type state
  const cableSourceType = formData._cable_source_type || "olt";

  // Splitter source type state
  const splitterSourceType = formData._splitter_source_type || "core";

  const handleSubmit = () => {
    switch (dialogType) {
      case "olt": createOlt.mutate(formData); break;
      case "cable": {
        const cablePayload = { ...formData };
        if (cableSourceType === "splitter_output") {
          cablePayload.source_type = "splitter";
          cablePayload.source_id = formData._source_output_id;
          cablePayload.pon_port_id = null;
        } else {
          cablePayload.source_type = "olt";
        }
        delete cablePayload._cable_source_type;
        delete cablePayload._source_output_id;
        createCable.mutate(cablePayload);
        break;
      }
      case "splitter": {
        const splitterPayload = { ...formData };
        if (splitterSourceType === "splitter_output") {
          splitterPayload.source_type = "splitter_output";
          splitterPayload.source_id = formData._source_output_id;
          splitterPayload.core_id = null;
        } else {
          splitterPayload.source_type = "core";
        }
        delete splitterPayload._splitter_source_type;
        delete splitterPayload._source_output_id;
        createSplitter.mutate(splitterPayload);
        break;
      }
      case "onu": createOnu.mutate(formData); break;
      case "splice": createSplice.mutate(formData); break;
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="ফাইবার নেটওয়ার্ক টপোলজি"
        description="OLT → Fiber → Core → Splice → Splitter → Fiber → Splitter → ONU (ফ্লেক্সিবল চেইনিং)"
        icon={<Network className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setFormData({ total_pon_ports: 8 }); setDialogType("olt"); }}>
              <Plus className="h-4 w-4 mr-1" /> OLT
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({ total_cores: 12, _cable_source_type: "olt" }); setDialogType("cable"); }}>
              <Plus className="h-4 w-4 mr-1" /> ক্যাবল
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({ ratio: "1:8", _splitter_source_type: "core" }); setDialogType("splitter"); }}>
              <Plus className="h-4 w-4 mr-1" /> স্প্লিটার
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({}); setDialogType("splice"); }}>
              <Link2 className="h-4 w-4 mr-1" /> স্প্লাইস
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({}); setDialogType("onu"); }}>
              <Plus className="h-4 w-4 mr-1" /> ONU
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="মোট OLT" value={stats.total_olts} icon={Server} color="bg-primary" />
          <StatCard label="মোট ক্যাবল" value={stats.total_cables} icon={Cable} color="bg-blue-600" />
          <StatCard label="ফ্রি কোর" value={stats.free_cores} icon={CircleDot} color="bg-emerald-600" />
          <StatCard label="স্প্লিটার" value={stats.total_splitters} icon={GitBranch} color="bg-amber-600" />
          <StatCard label="স্প্লাইস" value={stats.total_splices || 0} icon={Link2} color="bg-pink-600" />
          <StatCard label="মোট ONU" value={stats.total_onus} icon={Radio} color="bg-violet-600" />
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="OLT, ক্যাবল, কোর কালার, ONU সিরিয়াল দিয়ে খুঁজুন..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg divide-y divide-border">
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

      {/* Tabs: Tree + Map */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tree" className="gap-1.5"><TreePine className="h-4 w-4" /> ট্রি ভিউ</TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5"><MapIcon className="h-4 w-4" /> ম্যাপ ভিউ</TabsTrigger>
        </TabsList>

        {/* TREE VIEW */}
        <TabsContent value="tree">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> নেটওয়ার্ক হায়ারার্কি (ফ্লেক্সিবল চেইনিং)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {treeLoading ? (
                <div className="flex items-center justify-center py-12"><Activity className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : safeTree.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">কোন OLT পাওয়া যায়নি। প্রথমে একটি OLT তৈরি করুন।</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {safeTree.map(olt => (
                    <TreeNode
                      key={olt.id}
                      label={`${olt.name} ${olt.location ? `(${olt.location})` : ""}`}
                      icon={Server} iconColor="text-red-500"
                      badge={`${olt.total_pon_ports} পোর্ট`}
                      extra={olt.lat ? <MapPin className="h-3 w-3 text-muted-foreground" /> : undefined}
                      defaultOpen
                    >
                      {(olt.pon_ports || []).map(pp => (
                        <TreeNode key={pp.id} label={`PON Port ${pp.port_number}`} icon={Hash} iconColor="text-orange-500" badge={`${(pp.cables || []).length} ক্যাবল`} level={1}>
                          {(pp.cables || []).map(cable => (
                            <CableTreeNode key={cable.id} cable={cable} level={2} />
                          ))}
                        </TreeNode>
                      ))}
                    </TreeNode>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAP VIEW */}
        <TabsContent value="map">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary" /> ফাইবার নেটওয়ার্ক ম্যাপ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mapMarkers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">GPS কোঅর্ডিনেট সহ কোন OLT বা স্প্লিটার পাওয়া যায়নি।</p>
                </div>
              ) : (
                <TopologyMap markers={mapMarkers} />
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> OLT</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> স্প্লিটার</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── DIALOGS ───────────────────────── */}

      {/* OLT Dialog */}
      <Dialog open={dialogType === "olt"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>নতুন OLT তৈরি</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>নাম *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="OLT-1" /></div>
            <div><Label>লোকেশন</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Main POP" /></div>
            <div>
              <Label>GPS লোকেশন</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div><Label>PON পোর্ট সংখ্যা *</Label><Input type="number" value={formData.total_pon_ports || 8} onChange={e => setFormData({ ...formData, total_pon_ports: parseInt(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createOlt.isPending}>{createOlt.isPending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cable Dialog - FLEXIBLE SOURCE */}
      <Dialog open={dialogType === "cable"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>নতুন ফাইবার ক্যাবল</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>নাম *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Fiber-001" /></div>

            {/* Source Type Selector */}
            <div>
              <Label>সোর্স টাইপ *</Label>
              <Select value={cableSourceType} onValueChange={v => setFormData({ ...formData, _cable_source_type: v, pon_port_id: "", _source_output_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="olt">OLT PON Port</SelectItem>
                  <SelectItem value="splitter_output">স্প্লিটার আউটপুট 🔗</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {cableSourceType === "olt" ? (
              <div>
                <Label>PON পোর্ট</Label>
                <Select value={formData.pon_port_id || ""} onValueChange={v => setFormData({ ...formData, pon_port_id: v })}>
                  <SelectTrigger><SelectValue placeholder="পোর্ট সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>{allPonPorts.map(p => <SelectItem key={p.id} value={p.id}>{p.oltName} → Port {p.port_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>স্প্লিটার আউটপুট *</Label>
                <Select value={formData._source_output_id || ""} onValueChange={v => setFormData({ ...formData, _source_output_id: v })}>
                  <SelectTrigger><SelectValue placeholder="আউটপুট সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>
                    {allFreeOutputs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-1.5">
                          <ColorDot color={o.color} /> {o.path}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div><Label>কোর সংখ্যা *</Label><Input type="number" value={formData.total_cores || 12} onChange={e => setFormData({ ...formData, total_cores: parseInt(e.target.value) })} /></div>
            <div>
              <Label className="flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> কোর কালার (স্বয়ংক্রিয়ভাবে সেট হবে)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COLOR_LIST.slice(0, Math.min(formData.total_cores || 12, 12)).map(c => (
                  <span key={c} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted">
                    <ColorDot color={c} /> {c}
                  </span>
                ))}
              </div>
            </div>
            <div><Label>দৈর্ঘ্য (মিটার)</Label><Input type="number" value={formData.length_meters || ""} onChange={e => setFormData({ ...formData, length_meters: parseFloat(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createCable.isPending}>{createCable.isPending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Splitter Dialog - FLEXIBLE SOURCE */}
      <Dialog open={dialogType === "splitter"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>নতুন স্প্লিটার</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Source Type Selector */}
            <div>
              <Label>সোর্স টাইপ *</Label>
              <Select value={splitterSourceType} onValueChange={v => setFormData({ ...formData, _splitter_source_type: v, core_id: "", _source_output_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">ফাইবার কোর</SelectItem>
                  <SelectItem value="splitter_output">স্প্লিটার আউটপুট 🔗</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {splitterSourceType === "core" ? (
              <div>
                <Label>ফ্রি কোর *</Label>
                <Select value={formData.core_id || ""} onValueChange={v => setFormData({ ...formData, core_id: v })}>
                  <SelectTrigger><SelectValue placeholder="কোর সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>
                    {allFreeCores.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1.5"><ColorDot color={c.color} /> {c.oltName} → {c.cableName} → কোর {c.core_number}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>স্প্লিটার আউটপুট *</Label>
                <Select value={formData._source_output_id || ""} onValueChange={v => setFormData({ ...formData, _source_output_id: v })}>
                  <SelectTrigger><SelectValue placeholder="আউটপুট সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>
                    {allFreeOutputs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-1.5">
                          <ColorDot color={o.color} /> {o.path}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>রেশিও *</Label>
              <Select value={formData.ratio || "1:8"} onValueChange={v => setFormData({ ...formData, ratio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["1:2", "1:4", "1:8", "1:16", "1:32"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>GPS লোকেশন</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
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

      {/* Splice Dialog */}
      <Dialog open={dialogType === "splice"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><Link2 className="h-4 w-4 inline mr-1" /> কোর স্প্লাইস (Cable Join)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ক্যাবল A - কোর *</Label>
              <Select value={formData.from_core_id || ""} onValueChange={v => setFormData({ ...formData, from_core_id: v })}>
                <SelectTrigger><SelectValue placeholder="কোর সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {allCores.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5"><ColorDot color={c.color} /> {c.cableName} → কোর {c.core_number} ({c.color})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ক্যাবল B - কোর *</Label>
              <Select value={formData.to_core_id || ""} onValueChange={v => setFormData({ ...formData, to_core_id: v })}>
                <SelectTrigger><SelectValue placeholder="কোর সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {allCores.filter(c => c.id !== formData.from_core_id).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5"><ColorDot color={c.color} /> {c.cableName} → কোর {c.core_number} ({c.color})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>লেবেল</Label><Input value={formData.label || ""} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="Joint Box 1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>বাতিল</Button>
            <Button onClick={handleSubmit} disabled={createSplice.isPending}>{createSplice.isPending ? "তৈরি হচ্ছে..." : "স্প্লাইস করুন"}</Button>
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
                  {allFreeOutputs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="flex items-center gap-1.5">
                        <ColorDot color={o.color} /> {o.path}
                      </span>
                    </SelectItem>
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

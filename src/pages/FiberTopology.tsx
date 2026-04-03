import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Network, Plus, Search, Server, Cable, Cpu,
  GitBranch, Radio, User, Activity, Layers, CircleDot, Hash, MapPin,
  Link2, Palette, TreePine, Map as MapIcon, Pencil,
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
  updateFiberOltInSupabase,
  updateFiberCableInSupabase,
  updateFiberSplitterInSupabase,
  updateFiberOnuInSupabase,
  updateFiberSpliceInSupabase,
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
function TopologyMap({ markers, loadingText }: { markers: any[]; loadingText: string }) {
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
        <Activity className="h-6 w-6 animate-spin mr-2" /> {loadingText}
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
  const cableIcon = new L.Icon({
    iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });
  const onuIcon = new L.Icon({
    iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-violet.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "olt": return oltIcon;
      case "splitter": return splitterIcon;
      case "cable": return cableIcon;
      case "onu": return onuIcon;
      default: return splitterIcon;
    }
  };

  return (
    <div className="h-[400px] rounded-lg overflow-hidden border border-border">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
        {markers.map((m: any) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={getIcon(m.type)}>
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{m.name}</div>
                <div className="text-muted-foreground capitalize">{m.type}</div>
                {m.cable && <div className="text-xs">Cable: {m.cable}</div>}
                {m.customer && <div className="text-xs">Customer: {m.customer}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── HORIZONTAL TREE COMPONENTS ──────────────────────
// ═══════════════════════════════════════════════════════

const NODE_COLORS = {
  olt: "bg-red-500 text-white",
  port: "bg-orange-500 text-white",
  cable: "bg-blue-500 text-white",
  core: "bg-emerald-500 text-white",
  coreUsed: "bg-rose-500 text-white",
  splitter: "bg-amber-500 text-white",
  output: "bg-purple-500 text-white",
  outputFree: "bg-muted text-muted-foreground",
  onu: "bg-violet-600 text-white",
  customer: "bg-green-600 text-white",
};

function HNodeLabel({ text, colorClass, icon: Icon, sub, onEdit }: { text: string; colorClass: string; icon?: any; sub?: string; onEdit?: () => void }) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shadow-sm group/node", colorClass)}>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate max-w-[180px]">{text}</span>
      {sub && <span className="opacity-70 text-[10px]">{sub}</span>}
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="opacity-0 group-hover/node:opacity-100 transition-opacity ml-0.5 hover:scale-110">
          <Pencil className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function HTreeChildren({ children }: { children: React.ReactNode }) {
  return (
    <ul className="relative pl-6 before:content-[''] before:absolute before:left-3 before:top-0 before:bottom-0 before:w-px before:bg-border">
      {children}
    </ul>
  );
}

function HTreeItem({ children, isLast }: { children: React.ReactNode; isLast?: boolean }) {
  return (
    <li className="relative pl-4 py-0.5">
      {/* horizontal connector line */}
      <span className="absolute left-0 top-[14px] w-4 h-px bg-border" />
      {/* vertical connector - hide bottom for last item */}
      {!isLast && <span className="absolute left-0 top-0 bottom-0 w-px bg-border" />}
      {isLast && <span className="absolute left-0 top-0 h-[14px] w-px bg-border" />}
      {children}
    </li>
  );
}

function OnuHNode({ onu, t, onEdit }: { onu: FiberOnuData; t: any; onEdit?: (type: string, data: any) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <HNodeLabel text={onu.serial_number} colorClass={NODE_COLORS.onu} icon={Radio} onEdit={onEdit ? () => onEdit("edit_onu", { _edit_id: onu.id, serial_number: onu.serial_number, mac_address: onu.mac_address || "", status: onu.status, customer_id: onu.customer_id || "", lat: onu.lat, lng: onu.lng }) : undefined} />
      {onu.customer && (
        <>
          <span className="text-muted-foreground text-xs">←</span>
          <HNodeLabel text={`${onu.customer.name} (${onu.customer.customer_id})`} colorClass={NODE_COLORS.customer} icon={User} />
        </>
      )}
    </div>
  );
}

function OutputHNode({ output, t, isLast, onEdit }: { output: SplitterOutput; t: any; isLast: boolean; onEdit?: (type: string, data: any) => void }) {
  const isFree = output.status === "free";
  const hasChildren = !!(output.onu || output.child_cables?.length || output.child_splitter);

  return (
    <HTreeItem isLast={isLast}>
      <div className="flex items-center gap-1.5">
        <HNodeLabel
          text={`${t.fiberTopology.output} ${output.output_number}`}
          colorClass={isFree ? NODE_COLORS.outputFree : NODE_COLORS.output}
          icon={Cpu}
        />
        <ColorDot color={output.color} />
        {output.onu && !output.child_cables?.length && !output.child_splitter && (
          <>
            <span className="text-muted-foreground text-xs">→</span>
            <OnuHNode onu={output.onu} t={t} onEdit={onEdit} />
          </>
        )}
      </div>
      {hasChildren && (output.child_cables?.length || output.child_splitter) && (
        <HTreeChildren>
          {output.child_cables?.map((cable, i) => (
            <CableHNode key={cable.id} cable={cable} t={t} isLast={i === (output.child_cables!.length - 1) && !output.child_splitter} onEdit={onEdit} />
          ))}
          {output.child_splitter && (
            <SplitterHNode splitter={output.child_splitter} t={t} isLast onEdit={onEdit} />
          )}
        </HTreeChildren>
      )}
      {hasChildren && output.onu && (output.child_cables?.length || output.child_splitter) && (
        <div className="ml-6 flex items-center gap-1.5 mt-0.5">
          <OnuHNode onu={output.onu} t={t} onEdit={onEdit} />
        </div>
      )}
    </HTreeItem>
  );
}

function SplitterHNode({ splitter, t, isLast, onEdit }: { splitter: Splitter; t: any; isLast: boolean; onEdit?: (type: string, data: any) => void }) {
  const freeCount = (splitter.outputs || []).filter(o => o.status === "free").length;
  const outputs = splitter.outputs || [];

  return (
    <HTreeItem isLast={isLast}>
      <div className="flex items-center gap-1.5">
        <HNodeLabel
          text={`${t.fiberTopology.splitter} (${splitter.ratio})${splitter.label ? ` - ${splitter.label}` : ""}`}
          colorClass={NODE_COLORS.splitter}
          icon={GitBranch}
          onEdit={onEdit ? () => onEdit("edit_splitter", { _edit_id: splitter.id, label: splitter.label || "", location: splitter.location || "", status: splitter.status, lat: splitter.lat, lng: splitter.lng, ratio: splitter.ratio }) : undefined}
        />
        {splitter.lat && <MapPin className="h-3 w-3 text-muted-foreground" />}
        {splitter.source_type === "splitter_output" && <Badge variant="outline" className="text-[9px] h-4 px-1">🔗</Badge>}
      </div>
      {outputs.length > 0 && (
        <HTreeChildren>
          {outputs.map((output, i) => (
            <OutputHNode key={output.id} output={output} t={t} isLast={i === outputs.length - 1} onEdit={onEdit} />
          ))}
        </HTreeChildren>
      )}
    </HTreeItem>
  );
}

function CoreHNode({ core, t, isLast, onEdit }: { core: FiberCoreData; t: any; isLast: boolean; onEdit?: (type: string, data: any) => void }) {
  const hasSplitter = !!core.splitter;

  return (
    <HTreeItem isLast={isLast}>
      <div className="flex items-center gap-1.5">
        <HNodeLabel
          text={`${t.fiberTopology.core} ${core.core_number}`}
          colorClass={core.status === "free" ? NODE_COLORS.core : NODE_COLORS.coreUsed}
          icon={CircleDot}
        />
        <ColorDot color={core.color} />
        <Badge variant={core.status === "free" ? "secondary" : "destructive"} className="text-[9px] h-4 px-1">
          {core.status === "free" ? t.fiberTopology.free : t.fiberTopology.used}
        </Badge>
      </div>
      {hasSplitter && (
        <HTreeChildren>
          <SplitterHNode splitter={core.splitter!} t={t} isLast onEdit={onEdit} />
        </HTreeChildren>
      )}
    </HTreeItem>
  );
}

function CableHNode({ cable, t, isLast, onEdit }: { cable: FiberCableData; t: any; isLast: boolean; onEdit?: (type: string, data: any) => void }) {
  const freeCount = (cable.cores || []).filter(c => c.status === "free").length;

  return (
    <HTreeItem isLast={isLast}>
      <div className="flex items-center gap-1.5">
        <HNodeLabel
          text={`${cable.name} (${cable.total_cores} ${t.fiberTopology.cores})`}
          colorClass={NODE_COLORS.cable}
          icon={Cable}
          onEdit={onEdit ? () => onEdit("edit_cable", { _edit_id: cable.id, name: cable.name, color: cable.color || "", length_meters: cable.length_meters || "", status: cable.status, lat: cable.lat, lng: cable.lng }) : undefined}
        />
        {cable.source_type === "splitter" && <Badge variant="outline" className="text-[9px] h-4 px-1">🔗</Badge>}
      </div>
      {(cable.cores || []).length > 0 && (
        <HTreeChildren>
          {cable.cores.map((core, i) => (
            <CoreHNode key={core.id} core={core} t={t} isLast={i === cable.cores.length - 1} onEdit={onEdit} />
          ))}
        </HTreeChildren>
      )}
    </HTreeItem>
  );
}

// ─── Main Page ────────────────────────
export default function FiberTopology() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
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
    onSuccess: async (createdOlt) => { injectCreatedOltIntoTree(createdOlt); await invalidateAll(); toast.success(t.fiberTopology.oltCreated); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.message || t.fiberTopology.error),
  });

  const createCable = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberCableInSupabase(data);
      const response = await api.post("/fiber-topology/cables", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success(t.fiberTopology.cableCreated); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || t.fiberTopology.error),
  });

  const createSplitter = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberSplitterInSupabase(data);
      const response = await api.post("/fiber-topology/splitters", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success(t.fiberTopology.splitterCreated); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || t.fiberTopology.error),
  });

  const createOnu = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberOnuInSupabase(data);
      const response = await api.post("/fiber-topology/onus", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success(t.fiberTopology.onuAssigned); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || t.fiberTopology.error),
  });

  const createSplice = useMutation({
    mutationFn: async (data: any) => {
      if (IS_LOVABLE) return createFiberSpliceInSupabase(data);
      const response = await api.post("/fiber-topology/splices", data);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success(t.fiberTopology.spliceCreated); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.error || t.fiberTopology.error),
  });

  // ─── Edit Mutations ─────────────────
  const updateOlt = useMutation({
    mutationFn: async (data: any) => {
      const { _edit_id, ...rest } = data;
      if (IS_LOVABLE) return updateFiberOltInSupabase(_edit_id, rest);
      const response = await api.put(`/fiber-topology/olts/${_edit_id}`, rest);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("OLT updated"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const updateCable = useMutation({
    mutationFn: async (data: any) => {
      const { _edit_id, ...rest } = data;
      if (IS_LOVABLE) return updateFiberCableInSupabase(_edit_id, rest);
      const response = await api.put(`/fiber-topology/cables/${_edit_id}`, rest);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("Cable updated"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const updateSplitter = useMutation({
    mutationFn: async (data: any) => {
      const { _edit_id, ...rest } = data;
      if (IS_LOVABLE) return updateFiberSplitterInSupabase(_edit_id, rest);
      const response = await api.put(`/fiber-topology/splitters/${_edit_id}`, rest);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("Splitter updated"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const updateOnu = useMutation({
    mutationFn: async (data: any) => {
      const { _edit_id, ...rest } = data;
      if (IS_LOVABLE) return updateFiberOnuInSupabase(_edit_id, rest);
      const response = await api.put(`/fiber-topology/onus/${_edit_id}`, rest);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("ONU updated"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const updateSplice = useMutation({
    mutationFn: async (data: any) => {
      const { _edit_id, ...rest } = data;
      if (IS_LOVABLE) return updateFiberSpliceInSupabase(_edit_id, rest);
      const response = await api.put(`/fiber-topology/splices/${_edit_id}`, rest);
      return response.data ?? response;
    },
    onSuccess: async () => { toast.success("Splice updated"); await invalidateAll(); setDialogType(null); },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const handleEditNode = useCallback((type: string, data: any) => {
    setFormData(data);
    setDialogType(type);
  }, []);

  const allPonPorts = useMemo(() =>
    safeTree.flatMap(olt => (olt.pon_ports || []).map(p => ({ ...p, oltName: olt.name }))),
    [safeTree]
  );

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
  const allFreeOutputs = useMemo(() => collectAllFreeOutputs(safeTree), [safeTree]);

  const cableSourceType = formData._cable_source_type || "olt";
  const splitterSourceType = formData._splitter_source_type || "core";

  const handleSubmit = () => {
    switch (dialogType) {
      case "olt": createOlt.mutate(formData); break;
      case "edit_olt": updateOlt.mutate(formData); break;
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
      case "edit_cable": updateCable.mutate(formData); break;
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
      case "edit_splitter": updateSplitter.mutate(formData); break;
      case "onu": createOnu.mutate(formData); break;
      case "edit_onu": updateOnu.mutate(formData); break;
      case "splice": createSplice.mutate(formData); break;
      case "edit_splice": updateSplice.mutate(formData); break;
    }
  };

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-onu"],
    queryFn: async () => {
      const { data, error } = await db.from("customers").select("id, name, customer_id, phone").order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: dialogType === "onu" || dialogType === "edit_onu",
  });

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.customer_id?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    ).slice(0, 50);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() =>
    customers.find(c => c.id === formData.customer_id),
    [customers, formData.customer_id]
  );

  return (
    <DashboardLayout>
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title={t.fiberTopology.title}
        description={t.fiberTopology.description}
        icon={<Network className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setFormData({ total_pon_ports: 8 }); setDialogType("olt"); }}>
              <Plus className="h-4 w-4 mr-1" /> {t.fiberTopology.addOlt}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({ total_cores: 12, _cable_source_type: "olt" }); setDialogType("cable"); }}>
              <Plus className="h-4 w-4 mr-1" /> {t.fiberTopology.addCable}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({ ratio: "1:8", _splitter_source_type: "core" }); setDialogType("splitter"); }}>
              <Plus className="h-4 w-4 mr-1" /> {t.fiberTopology.addSplitter}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({}); setDialogType("splice"); }}>
              <Link2 className="h-4 w-4 mr-1" /> {t.fiberTopology.addSplice}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFormData({}); setDialogType("onu"); }}>
              <Plus className="h-4 w-4 mr-1" /> {t.fiberTopology.addOnu}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label={t.fiberTopology.totalOlt} value={stats.total_olts} icon={Server} color="bg-primary" />
          <StatCard label={t.fiberTopology.totalCable} value={stats.total_cables} icon={Cable} color="bg-blue-600" />
          <StatCard label={t.fiberTopology.freeCores} value={stats.free_cores} icon={CircleDot} color="bg-emerald-600" />
          <StatCard label={t.fiberTopology.splitters} value={stats.total_splitters} icon={GitBranch} color="bg-amber-600" />
          <StatCard label={t.fiberTopology.splices} value={stats.total_splices || 0} icon={Link2} color="bg-pink-600" />
          <StatCard label={t.fiberTopology.totalOnu} value={stats.total_onus} icon={Radio} color="bg-violet-600" />
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.fiberTopology.searchPlaceholder} value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
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
          <TabsTrigger value="tree" className="gap-1.5"><TreePine className="h-4 w-4" /> {t.fiberTopology.treeView}</TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5"><MapIcon className="h-4 w-4" /> {t.fiberTopology.mapView}</TabsTrigger>
        </TabsList>

        {/* TREE VIEW - HORIZONTAL */}
        <TabsContent value="tree">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> {t.fiberTopology.networkHierarchy}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {treeLoading ? (
                <div className="flex items-center justify-center py-12"><Activity className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : safeTree.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t.fiberTopology.noOltFound}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[600px] space-y-4">
                    {safeTree.map(olt => (
                      <div key={olt.id}>
                        {/* OLT root */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <HNodeLabel
                            text={`${olt.name}${olt.location ? ` (${olt.location})` : ""}`}
                            colorClass={NODE_COLORS.olt} icon={Server}
                            onEdit={() => handleEditNode("edit_olt", { _edit_id: olt.id, name: olt.name, location: olt.location || "", status: olt.status, lat: olt.lat, lng: olt.lng, total_pon_ports: olt.total_pon_ports })}
                          />
                          {olt.lat && <MapPin className="h-3 w-3 text-muted-foreground" />}
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">{olt.total_pon_ports} {t.fiberTopology.ports}</Badge>
                        </div>

                        {/* PON Ports */}
                        <HTreeChildren>
                          {(olt.pon_ports || []).map((pp, ppIdx) => (
                            <HTreeItem key={pp.id} isLast={ppIdx === (olt.pon_ports || []).length - 1}>
                              <div className="flex items-center gap-1.5">
                                <HNodeLabel text={`PON Port ${pp.port_number}`} colorClass={NODE_COLORS.port} icon={Hash} />
                                <span className="text-[10px] text-muted-foreground">{(pp.cables || []).length} {t.fiberTopology.cables}</span>
                              </div>

                              {/* Cables under port */}
                              {(pp.cables || []).length > 0 && (
                                <HTreeChildren>
                                  {pp.cables.map((cable, cIdx) => (
                                    <CableHNode key={cable.id} cable={cable} t={t} isLast={cIdx === pp.cables.length - 1} onEdit={handleEditNode} />
                                  ))}
                                </HTreeChildren>
                              )}
                            </HTreeItem>
                          ))}
                        </HTreeChildren>
                      </div>
                    ))}
                  </div>
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
                <MapIcon className="h-4 w-4 text-primary" /> {t.fiberTopology.fiberNetworkMap}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mapMarkers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t.fiberTopology.noGpsFound}</p>
                </div>
              ) : (
                <TopologyMap markers={mapMarkers} loadingText={t.fiberTopology.loadingMap} />
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> OLT</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Cable</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> {t.fiberTopology.splitter}</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-violet-500 inline-block" /> ONU</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── DIALOGS ───────────────────────── */}

      {/* OLT Dialog */}
      <Dialog open={dialogType === "olt"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t.fiberTopology.createNewOlt}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.fiberTopology.name} *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="OLT-1" /></div>
            <div><Label>{t.fiberTopology.location}</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Main POP" /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div><Label>{t.fiberTopology.ponPortCount} *</Label><Input type="number" value={formData.total_pon_ports || 8} onChange={e => setFormData({ ...formData, total_pon_ports: parseInt(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createOlt.isPending}>{createOlt.isPending ? t.fiberTopology.creating : t.fiberTopology.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cable Dialog */}
      <Dialog open={dialogType === "cable"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t.fiberTopology.newFiberCable}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.fiberTopology.name} *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Fiber-001" /></div>
            <div>
              <Label>{t.fiberTopology.sourceType} *</Label>
              <Select value={cableSourceType} onValueChange={v => setFormData({ ...formData, _cable_source_type: v, pon_port_id: "", _source_output_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="olt">{t.fiberTopology.oltPonPort}</SelectItem>
                  <SelectItem value="splitter_output">{t.fiberTopology.splitterOutput}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cableSourceType === "olt" ? (
              <div>
                <Label>PON Port</Label>
                <Select value={formData.pon_port_id || ""} onValueChange={v => setFormData({ ...formData, pon_port_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectPort} /></SelectTrigger>
                  <SelectContent>{allPonPorts.map(p => <SelectItem key={p.id} value={p.id}>{p.oltName} → Port {p.port_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>{t.fiberTopology.splitterOutput} *</Label>
                <Select value={formData._source_output_id || ""} onValueChange={v => setFormData({ ...formData, _source_output_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectOutput} /></SelectTrigger>
                  <SelectContent>
                    {allFreeOutputs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-1.5"><ColorDot color={o.color} /> {o.path}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{t.fiberTopology.coreCount} *</Label><Input type="number" value={formData.total_cores || 12} onChange={e => setFormData({ ...formData, total_cores: parseInt(e.target.value) })} /></div>
            <div>
              <Label className="flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> {t.fiberTopology.coreColors}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COLOR_LIST.slice(0, Math.min(formData.total_cores || 12, 12)).map(c => (
                  <span key={c} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted"><ColorDot color={c} /> {c}</span>
                ))}
              </div>
            </div>
            <div><Label>{t.fiberTopology.lengthMeters}</Label><Input type="number" value={formData.length_meters || ""} onChange={e => setFormData({ ...formData, length_meters: parseFloat(e.target.value) })} /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createCable.isPending}>{createCable.isPending ? t.fiberTopology.creating : t.fiberTopology.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Splitter Dialog */}
      <Dialog open={dialogType === "splitter"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t.fiberTopology.newSplitter}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.fiberTopology.sourceType} *</Label>
              <Select value={splitterSourceType} onValueChange={v => setFormData({ ...formData, _splitter_source_type: v, core_id: "", _source_output_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">{t.fiberTopology.fiberCore}</SelectItem>
                  <SelectItem value="splitter_output">{t.fiberTopology.splitterOutput}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {splitterSourceType === "core" ? (
              <div>
                <Label>{t.fiberTopology.freeCore} *</Label>
                <Select value={formData.core_id || ""} onValueChange={v => setFormData({ ...formData, core_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectCore} /></SelectTrigger>
                  <SelectContent>
                    {allFreeCores.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1.5"><ColorDot color={c.color} /> {c.oltName} → {c.cableName} → {t.fiberTopology.core} {c.core_number}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>{t.fiberTopology.splitterOutput} *</Label>
                <Select value={formData._source_output_id || ""} onValueChange={v => setFormData({ ...formData, _source_output_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectOutput} /></SelectTrigger>
                  <SelectContent>
                    {allFreeOutputs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-1.5"><ColorDot color={o.color} /> {o.path}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t.fiberTopology.ratio} *</Label>
              <Select value={formData.ratio || "1:8"} onValueChange={v => setFormData({ ...formData, ratio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["1:2", "1:4", "1:8", "1:16", "1:32"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div><Label>{t.fiberTopology.location}</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div><Label>{t.fiberTopology.label}</Label><Input value={formData.label || ""} onChange={e => setFormData({ ...formData, label: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createSplitter.isPending}>{createSplitter.isPending ? t.fiberTopology.creating : t.fiberTopology.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Splice Dialog */}
      <Dialog open={dialogType === "splice"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><Link2 className="h-4 w-4 inline mr-1" /> {t.fiberTopology.coreSplice}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.fiberTopology.cableACoreLabel} *</Label>
              <Select value={formData.from_core_id || ""} onValueChange={v => setFormData({ ...formData, from_core_id: v })}>
                <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectCore} /></SelectTrigger>
                <SelectContent>
                  {allCores.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5"><ColorDot color={c.color} /> {c.cableName} → {t.fiberTopology.core} {c.core_number} ({c.color})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.fiberTopology.cableBCoreLabel} *</Label>
              <Select value={formData.to_core_id || ""} onValueChange={v => setFormData({ ...formData, to_core_id: v })}>
                <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectCore} /></SelectTrigger>
                <SelectContent>
                  {allCores.filter(c => c.id !== formData.from_core_id).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5"><ColorDot color={c.color} /> {c.cableName} → {t.fiberTopology.core} {c.core_number} ({c.color})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t.fiberTopology.label}</Label><Input value={formData.label || ""} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="Joint Box 1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createSplice.isPending}>{createSplice.isPending ? t.fiberTopology.splicing : t.fiberTopology.doSplice}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ONU Dialog */}
      <Dialog open={dialogType === "onu"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t.fiberTopology.assignOnu}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.fiberTopology.freeOutput} *</Label>
              <Select value={formData.splitter_output_id || ""} onValueChange={v => setFormData({ ...formData, splitter_output_id: v })}>
                <SelectTrigger><SelectValue placeholder={t.fiberTopology.selectOutput} /></SelectTrigger>
                <SelectContent>
                  {allFreeOutputs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="flex items-center gap-1.5"><ColorDot color={o.color} /> {o.path}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t.fiberTopology.serialNumber} *</Label><Input value={formData.serial_number || ""} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} placeholder="HWTC-XXXX" /></div>
            <div><Label>{t.fiberTopology.macAddress}</Label><Input value={formData.mac_address || ""} onChange={e => setFormData({ ...formData, mac_address: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div>
              <Label>{t.fiberTopology.customer}</Label>
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {selectedCustomer
                      ? `${selectedCustomer.name} (${selectedCustomer.customer_id})`
                      : t.fiberTopology.selectCustomer}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder={t.fiberTopology.searchCustomer}
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">{t.fiberTopology.noCustomerFound}</div>
                    ) : (
                      filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
                          onClick={() => {
                            setFormData({ ...formData, customer_id: c.id });
                            setCustomerPopoverOpen(false);
                            setCustomerSearch("");
                          }}
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.name}</span>
                          <span className="text-muted-foreground ml-auto shrink-0">#{c.customer_id}</span>
                        </button>
                      ))
                    )}
                  </div>
                  {formData.customer_id && (
                    <div className="border-t p-2">
                      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => {
                        setFormData({ ...formData, customer_id: "" });
                        setCustomerPopoverOpen(false);
                      }}>{t.fiberTopology.clearSelection}</Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createOnu.isPending}>{createOnu.isPending ? t.fiberTopology.assigning : t.fiberTopology.assign}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT DIALOGS ─────────────────── */}

      {/* Edit OLT Dialog */}
      <Dialog open={dialogType === "edit_olt"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><Pencil className="h-4 w-4 inline mr-1" /> Edit OLT</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.fiberTopology.name} *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><Label>{t.fiberTopology.location}</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status || "active"} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={updateOlt.isPending}>{updateOlt.isPending ? "Updating..." : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Cable Dialog */}
      <Dialog open={dialogType === "edit_cable"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><Pencil className="h-4 w-4 inline mr-1" /> Edit Cable</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.fiberTopology.name} *</Label><Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><Label>{t.fiberTopology.lengthMeters}</Label><Input type="number" value={formData.length_meters || ""} onChange={e => setFormData({ ...formData, length_meters: parseFloat(e.target.value) })} /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status || "active"} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={updateCable.isPending}>{updateCable.isPending ? "Updating..." : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Splitter Dialog */}
      <Dialog open={dialogType === "edit_splitter"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><Pencil className="h-4 w-4 inline mr-1" /> Edit Splitter</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.fiberTopology.label}</Label><Input value={formData.label || ""} onChange={e => setFormData({ ...formData, label: e.target.value })} /></div>
            <div><Label>{t.fiberTopology.location}</Label><Input value={formData.location || ""} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status || "active"} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={updateSplitter.isPending}>{updateSplitter.isPending ? "Updating..." : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit ONU Dialog */}
      <Dialog open={dialogType === "edit_onu"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><Pencil className="h-4 w-4 inline mr-1" /> Edit ONU</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.fiberTopology.serialNumber} *</Label><Input value={formData.serial_number || ""} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} /></div>
            <div><Label>{t.fiberTopology.macAddress}</Label><Input value={formData.mac_address || ""} onChange={e => setFormData({ ...formData, mac_address: e.target.value })} /></div>
            <div>
              <Label>{t.fiberTopology.gpsLocation}</Label>
              <MapLocationPicker lat={formData.lat} lng={formData.lng} onSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} />
            </div>
            <div>
              <Label>{t.fiberTopology.customer}</Label>
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {selectedCustomer
                      ? `${selectedCustomer.name} (${selectedCustomer.customer_id})`
                      : t.fiberTopology.selectCustomer}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input placeholder={t.fiberTopology.searchCustomer} value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-9" />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">{t.fiberTopology.noCustomerFound}</div>
                    ) : (
                      filteredCustomers.map(c => (
                        <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2" onClick={() => { setFormData({ ...formData, customer_id: c.id }); setCustomerPopoverOpen(false); setCustomerSearch(""); }}>
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.name}</span>
                          <span className="text-muted-foreground ml-auto shrink-0">#{c.customer_id}</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status || "active"} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>{t.fiberTopology.cancel}</Button>
            <Button onClick={handleSubmit} disabled={updateOnu.isPending}>{updateOnu.isPending ? "Updating..." : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}

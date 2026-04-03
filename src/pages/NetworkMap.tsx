import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/apiDb";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Plus, Search, Trash2, Link2, Filter, Eye, EyeOff, ZoomIn, MapPin, Network,
  Radio, Router, Cpu, User, LocateFixed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Fix default marker icons ──
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ── Types ──
interface NetworkNode {
  id: string;
  name: string;
  type: "olt" | "splitter" | "onu" | "customer" | "router" | "switch";
  lat: number;
  lng: number;
  parent_id: string | null;
  status: "online" | "offline" | "maintenance";
  device_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface NetworkLink {
  id: string;
  from_node_id: string;
  to_node_id: string;
  link_type: string;
  label: string | null;
  from_node?: { id: string; name: string; lat: number; lng: number };
  to_node?: { id: string; name: string; lat: number; lng: number };
}

// ── Marker icons by type ──
const NODE_COLORS: Record<string, string> = {
  olt: "#ef4444",
  router: "#f97316",
  splitter: "#a855f7",
  switch: "#eab308",
  onu: "#22c55e",
  customer: "#3b82f6",
};

const NODE_LABELS: Record<string, string> = {
  olt: "OLT",
  router: "Router",
  splitter: "Splitter",
  switch: "Switch",
  onu: "ONU",
  customer: "Customer",
};

const createColorIcon = (color: string, status: string) => {
  const opacity = status === "offline" ? 0.5 : 1;
  const borderColor = status === "maintenance" ? "#eab308" : color;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};opacity:${opacity};
      border:3px solid ${borderColor};
      box-shadow:0 2px 8px ${color}66;
      display:flex;align-items:center;justify-content:center;
    "><div style="width:8px;height:8px;border-radius:50%;background:white;"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
};

// ── Map click handler ──
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Fly to component ──
function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 16);
  }, [center, map]);
  return null;
}

// ── Draggable marker ──
function DraggableMarker({
  node,
  onDragEnd,
  onClick,
  isSelected,
}: {
  node: NetworkNode;
  onDragEnd: (id: string, lat: number, lng: number) => void;
  onClick: (node: NetworkNode) => void;
  isSelected: boolean;
}) {
  const markerRef = useRef<L.Marker>(null);
  const icon = createColorIcon(NODE_COLORS[node.type] || "#6b7280", node.status);

  return (
    <Marker
      ref={markerRef}
      position={[node.lat, node.lng]}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: () => {
          const marker = markerRef.current;
          if (marker) {
            const pos = marker.getLatLng();
            onDragEnd(node.id, pos.lat, pos.lng);
          }
        },
        click: () => onClick(node),
      }}
    >
      <Popup>
        <div className="text-sm space-y-1 min-w-[140px]">
          <p className="font-bold">{node.name}</p>
          <p className="text-xs capitalize">{NODE_LABELS[node.type]} • {node.status}</p>
        </div>
      </Popup>
    </Marker>
  );
}

// ── Main Component ──
export default function NetworkMap() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showLinks, setShowLinks] = useState(true);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<NetworkNode | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<string>("onu");
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Queries ──
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["network-nodes"],
    queryFn: async () => {
      const { data, error } = await db.from("network_nodes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NetworkNode[];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["network-links"],
    queryFn: async () => {
      const { data, error } = await db.from("network_links").select("*");
      if (error) throw error;
      return (data || []) as NetworkLink[];
    },
  });

  // ── Mutations ──
  const createNode = useMutation({
    mutationFn: async (payload: Partial<NetworkNode>) => {
      const { data, error } = await db.from("network_nodes").insert(payload);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-nodes"] });
      toast.success("Node created");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create node"),
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<NetworkNode>) => {
      const { data, error } = await db.from("network_nodes").update(payload).eq("id", id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["network-nodes"] }),
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("network_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["network-links"] });
      toast.success("Node deleted");
      setSelectedNode(null);
    },
  });

  const createLink = useMutation({
    mutationFn: async (payload: { from_node_id: string; to_node_id: string; link_type?: string }) => {
      const { data, error } = await db.from("network_links").insert(payload);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-links"] });
      toast.success("Link created");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create link"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("network_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-links"] });
      toast.success("Link removed");
    },
  });

  // ── Handlers ──
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!addMode) return;
      setPendingLatLng({ lat, lng });
      setAddDialog(true);
    },
    [addMode]
  );

  const handleCreateNode = () => {
    if (!pendingLatLng || !newNodeName.trim()) return;
    createNode.mutate({
      name: newNodeName.trim(),
      type: newNodeType as NetworkNode["type"],
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      status: "online",
    });
    setAddDialog(false);
    setNewNodeName("");
    setNewNodeType("onu");
    setPendingLatLng(null);
    setAddMode(false);
  };

  const handleDragEnd = useCallback(
    (id: string, lat: number, lng: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNode.mutate({ id, lat, lng });
      }, 500);
    },
    [updateNode]
  );

  const handleNodeClick = useCallback(
    (node: NetworkNode) => {
      if (connectMode) {
        if (!connectFrom) {
          setConnectFrom(node);
          toast.info(`Selected: ${node.name}. Now click the second node.`);
        } else if (connectFrom.id !== node.id) {
          createLink.mutate({ from_node_id: connectFrom.id, to_node_id: node.id, link_type: "fiber" });
          setConnectFrom(null);
          setConnectMode(false);
        }
      } else {
        setSelectedNode(node);
      }
    },
    [connectMode, connectFrom, createLink]
  );

  // ── Filtered nodes ──
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [nodes, typeFilter, search]);

  // ── Build link lines (resolve positions from nodes) ──
  const linkLines = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return links
      .map((link) => {
        const from = nodeMap.get(link.from_node_id);
        const to = nodeMap.get(link.to_node_id);
        if (!from || !to) return null;
        return { ...link, fromPos: [from.lat, from.lng] as [number, number], toPos: [to.lat, to.lng] as [number, number] };
      })
      .filter(Boolean) as (NetworkLink & { fromPos: [number, number]; toPos: [number, number] })[];
  }, [links, nodes]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total: nodes.length,
    online: nodes.filter((n) => n.status === "online").length,
    offline: nodes.filter((n) => n.status === "offline").length,
    links: links.length,
  }), [nodes, links]);

  const mapCenter: [number, number] = nodes.length > 0
    ? [nodes.reduce((s, n) => s + n.lat, 0) / nodes.length, nodes.reduce((s, n) => s + n.lng, 0) / nodes.length]
    : [23.8103, 90.4125]; // Dhaka default

  return (
    <DashboardLayout>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            {t.networkMap.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.networkMap.subtitle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t.networkMap.totalNodes, value: stats.total, icon: Cpu, color: "text-primary" },
          { label: t.networkMap.online, value: stats.online, icon: Radio, color: "text-emerald-500" },
          { label: t.networkMap.offline, value: stats.offline, icon: Radio, color: "text-destructive" },
          { label: t.networkMap.connections, value: stats.links, icon: Link2, color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label} className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted/50", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.networkMap.searchNodes}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 bg-background/50"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-background/50">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(NODE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant={addMode ? "default" : "outline"}
              onClick={() => { setAddMode(!addMode); setConnectMode(false); }}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-1" />
              {addMode ? t.networkMap.clickMap : t.networkMap.addNode}
            </Button>

            <Button
              size="sm"
              variant={connectMode ? "default" : "outline"}
              onClick={() => { setConnectMode(!connectMode); setConnectFrom(null); setAddMode(false); }}
              className="h-9"
            >
              <Link2 className="h-4 w-4 mr-1" />
              {connectMode ? (connectFrom ? t.networkMap.selectSecond : t.networkMap.selectFirst) : t.networkMap.connect}
            </Button>

            <Button size="sm" variant="outline" onClick={() => setShowLinks(!showLinks)} className="h-9">
              {showLinks ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              Lines
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                {NODE_LABELS[type]}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[65vh] w-full relative" style={{ cursor: addMode ? "crosshair" : "grab" }}>
            <MapContainer
              center={mapCenter}
              zoom={13}
              className="h-full w-full z-0"
              style={{ background: "hsl(var(--muted))" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler onClick={handleMapClick} />
              <FlyTo center={flyTarget} />

              {/* Links */}
              {showLinks &&
                linkLines.map((link) => (
                  <Polyline
                    key={link.id}
                    positions={[link.fromPos, link.toPos]}
                    pathOptions={{ color: "#a855f7", weight: 2, opacity: 0.7, dashArray: "6 4" }}
                    eventHandlers={{
                      click: () => {
                        if (confirm("Delete this connection?")) {
                          deleteLink.mutate(link.id);
                        }
                      },
                    }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-medium">{link.link_type || "fiber"} link</p>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="mt-1 h-6 text-xs"
                          onClick={() => deleteLink.mutate(link.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Popup>
                  </Polyline>
                ))}

              {/* Nodes */}
              {filteredNodes.map((node) => (
                <DraggableMarker
                  key={node.id}
                  node={node}
                  onDragEnd={handleDragEnd}
                  onClick={handleNodeClick}
                  isSelected={selectedNode?.id === node.id}
                />
              ))}
            </MapContainer>

            {/* Instruction overlay */}
            {(addMode || connectMode) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                {addMode
                  ? t.networkMap.clickMapToPlace
                  : connectFrom
                    ? t.networkMap.clickSecondNode.replace("{name}", connectFrom.name)
                    : t.networkMap.clickFirstNode}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Node List Sidebar */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Node List ({filteredNodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t.networkMap.noNodesYet}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedNode?.id === node.id && "ring-2 ring-primary bg-primary/5"
                  )}
                  onClick={() => {
                    setSelectedNode(node);
                    setFlyTarget([node.lat, node.lng]);
                  }}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: NODE_COLORS[node.type] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{node.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{NODE_LABELS[node.type]}</p>
                  </div>
                  <Badge variant={node.status === "online" ? "default" : "destructive"} className="text-[10px] h-5">
                    {node.status}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.networkMap.deleteNodeConfirm.replace("{name}", node.name))) deleteNode.mutate(node.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Node Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {t.networkMap.addNetworkNode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newNodeName} onChange={(e) => setNewNodeName(e.target.value)} placeholder="e.g. OLT-Main, Splitter-Zone-1" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newNodeType} onValueChange={setNewNodeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NODE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS[k] }} />
                        {v}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pendingLatLng && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                📍 Lat: {pendingLatLng.lat.toFixed(6)}, Lng: {pendingLatLng.lng.toFixed(6)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialog(false); setAddMode(false); }}>Cancel</Button>
            <Button onClick={handleCreateNode} disabled={!newNodeName.trim() || createNode.isPending}>
              {createNode.isPending ? t.networkMap.creating : t.networkMap.createNode}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}

import { db } from "@/integrations/supabase/client";

export interface FiberCustomer {
  id: string;
  name: string;
  customer_id: string;
}

export interface FiberOnuData {
  id: string;
  serial_number: string;
  mac_address: string;
  status: string;
  customer_id: string;
  customer?: FiberCustomer;
}

export interface SplitterOutput {
  id: string;
  output_number: number;
  status: string;
  color?: string;
  connection_type?: string;
  connected_id?: string;
  onu?: FiberOnuData;
  // Chained children
  child_cables?: FiberCableData[];
  child_splitter?: Splitter;
}

export interface Splitter {
  id: string;
  ratio: string;
  location: string;
  label: string;
  status: string;
  lat?: number;
  lng?: number;
  source_type?: string;
  source_id?: string;
  outputs: SplitterOutput[];
}

export interface FiberCoreData {
  id: string;
  core_number: number;
  color: string;
  status: string;
  connected_olt_port_id?: string;
  splitter?: Splitter;
}

export interface FiberCableData {
  id: string;
  name: string;
  total_cores: number;
  color: string;
  length_meters: number;
  status: string;
  source_type?: string;
  source_id?: string;
  cores: FiberCoreData[];
}

export interface PonPort {
  id: string;
  port_number: number;
  status: string;
  cables: FiberCableData[];
}

export interface OltData {
  id: string;
  name: string;
  location: string;
  total_pon_ports: number;
  status: string;
  lat?: number;
  lng?: number;
  pon_ports: PonPort[];
}

export interface Stats {
  total_olts: number;
  total_cables: number;
  total_cores: number;
  free_cores: number;
  used_cores: number;
  total_splitters: number;
  total_outputs: number;
  free_outputs: number;
  used_outputs: number;
  total_onus: number;
  total_splices?: number;
}

export interface FiberMapMarker {
  id: string;
  type: "olt" | "splitter";
  name: string;
  lat: number;
  lng: number;
  cable?: string | null;
}

export interface FiberSearchResult {
  type: string;
  id: string;
  label: string;
}

const DEFAULT_FIBER_COLORS = [
  "Blue", "Orange", "Green", "Brown", "Slate", "White",
  "Red", "Black", "Yellow", "Violet", "Rose", "Aqua",
];

export const EMPTY_FIBER_STATS: Stats = {
  total_olts: 0, total_cables: 0, total_cores: 0,
  free_cores: 0, used_cores: 0, total_splitters: 0,
  total_outputs: 0, free_outputs: 0, used_outputs: 0,
  total_onus: 0, total_splices: 0,
};

const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const nullableString = (value: unknown) => {
  const next = safeString(value);
  return next.length > 0 ? next : null;
};
const nullableNumber = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const sortByNumber = <T>(items: T[], selector: (item: T) => number) =>
  [...items].sort((left, right) => selector(left) - selector(right));

export function unwrapApiArray<T>(payload: unknown): T[] {
  const data =
    (payload as { data?: unknown } | null)?.data ??
    (payload as { items?: unknown } | null)?.items ??
    (payload as { results?: unknown } | null)?.results ??
    payload;
  return Array.isArray(data) ? (data as T[]) : [];
}

export function unwrapApiObject<T>(payload: unknown, fallback: T): T {
  const data = (payload as { data?: unknown } | null)?.data;
  const candidate =
    data && typeof data === "object" && !Array.isArray(data) ? data : payload;
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as T)
    : fallback;
}

export async function resolveFiberTenantId(): Promise<string | null> {
  try {
    const currentUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
    if (currentUser?.tenant_id) return currentUser.tenant_id;
    if (!currentUser?.id) return null;

    const { data, error } = await db
      .from("profiles")
      .select("tenant_id")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error) throw error;
    return data?.tenant_id ?? null;
  } catch {
    return null;
  }
}

async function requireFiberTenantId() {
  const tenantId = await resolveFiberTenantId();
  if (!tenantId) throw new Error("Tenant context not found");
  return tenantId;
}

// ─── Recursive tree builder with splitter chaining ───────────────

interface RawOutput {
  id: string;
  splitter_id: string;
  output_number: number;
  status: string;
  color: string | null;
  connection_type: string | null;
  connected_id: string | null;
  tenant_id: string;
}

interface RawSplitter {
  id: string;
  core_id: string | null;
  ratio: string;
  location: string | null;
  label: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  source_type: string | null;
  source_id: string | null;
  tenant_id: string;
}

interface RawCable {
  id: string;
  name: string;
  total_cores: number;
  color: string | null;
  length_meters: number | null;
  status: string;
  pon_port_id: string | null;
  source_type: string | null;
  source_id: string | null;
  tenant_id: string;
}

interface RawCore {
  id: string;
  fiber_cable_id: string;
  core_number: number;
  color: string | null;
  status: string;
  connected_olt_port_id: string | null;
  tenant_id: string;
}

function buildSplitterNode(
  splitterId: string,
  splittersById: Map<string, RawSplitter>,
  outputsBySplitterId: Map<string, RawOutput[]>,
  onusByOutputId: Map<string, FiberOnuData>,
  cablesBySourceId: Map<string, RawCable[]>,
  splittersBySourceId: Map<string, RawSplitter>,
  coresByCableId: Map<string, RawCore[]>,
  splittersByCoreId: Map<string, string>,
  visited: Set<string>,
): Splitter | undefined {
  if (visited.has(splitterId)) return undefined; // Prevent loops
  visited.add(splitterId);

  const raw = splittersById.get(splitterId);
  if (!raw) return undefined;

  const rawOutputs = outputsBySplitterId.get(splitterId) || [];
  const outputs: SplitterOutput[] = sortByNumber(rawOutputs, (o) => o.output_number).map((output) => {
    const so: SplitterOutput = {
      id: output.id,
      output_number: output.output_number,
      status: output.status || "free",
      color: output.color || undefined,
      connection_type: output.connection_type || undefined,
      connected_id: output.connected_id || undefined,
      onu: onusByOutputId.get(output.id),
    };

    // Child cables from this output
    const childCablesRaw = cablesBySourceId.get(output.id) || [];
    if (childCablesRaw.length > 0) {
      so.child_cables = childCablesRaw.map((cable) =>
        buildCableNode(cable, coresByCableId, splittersByCoreId, splittersById, outputsBySplitterId, onusByOutputId, cablesBySourceId, splittersBySourceId, splittersByCoreId, visited)
      );
    }

    // Child splitter from this output
    const childSplitterRaw = splittersBySourceId.get(output.id);
    if (childSplitterRaw) {
      so.child_splitter = buildSplitterNode(
        childSplitterRaw.id, splittersById, outputsBySplitterId, onusByOutputId,
        cablesBySourceId, splittersBySourceId, coresByCableId, splittersByCoreId, visited
      );
    }

    return so;
  });

  return {
    id: raw.id,
    ratio: raw.ratio,
    location: raw.location || "",
    label: raw.label || "",
    status: raw.status || "active",
    lat: raw.lat ?? undefined,
    lng: raw.lng ?? undefined,
    source_type: raw.source_type || undefined,
    source_id: raw.source_id || undefined,
    outputs,
  };
}

function buildCableNode(
  cable: RawCable,
  coresByCableId: Map<string, RawCore[]>,
  splittersByCoreId: Map<string, string>,
  splittersById: Map<string, RawSplitter>,
  outputsBySplitterId: Map<string, RawOutput[]>,
  onusByOutputId: Map<string, FiberOnuData>,
  cablesBySourceId: Map<string, RawCable[]>,
  splittersBySourceId: Map<string, RawSplitter>,
  _splittersByCoreId: Map<string, string>,
  visited: Set<string>,
): FiberCableData {
  const rawCores = coresByCableId.get(cable.id) || [];
  const cores: FiberCoreData[] = sortByNumber(rawCores, (c) => c.core_number).map((core) => {
    const splitterId = splittersByCoreId.get(core.id);
    return {
      id: core.id,
      core_number: core.core_number,
      color: core.color || "",
      status: core.status || "free",
      connected_olt_port_id: core.connected_olt_port_id || undefined,
      splitter: splitterId
        ? buildSplitterNode(splitterId, splittersById, outputsBySplitterId, onusByOutputId, cablesBySourceId, splittersBySourceId, coresByCableId, splittersByCoreId, visited)
        : undefined,
    };
  });

  return {
    id: cable.id,
    name: cable.name,
    total_cores: cable.total_cores,
    color: cable.color || "",
    length_meters: cable.length_meters || 0,
    status: cable.status || "active",
    source_type: cable.source_type || undefined,
    source_id: cable.source_id || undefined,
    cores,
  };
}

export async function fetchFiberTopologyTreeFromSupabase(): Promise<OltData[]> {
  const tenantId = await resolveFiberTenantId();
  if (!tenantId) return [];

  const [
    oltsResult, ponPortsResult, cablesResult, coresResult,
    splittersResult, outputsResult, onusResult,
  ] = await Promise.all([
    db.from("fiber_olts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    db.from("fiber_pon_ports").select("*").eq("tenant_id", tenantId).order("port_number"),
    db.from("fiber_cables").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    db.from("fiber_cores").select("*").eq("tenant_id", tenantId).order("core_number"),
    db.from("fiber_splitters").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    db.from("fiber_splitter_outputs").select("*").eq("tenant_id", tenantId).order("output_number"),
    db.from("fiber_onus").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
  ]);

  const firstError = [
    oltsResult.error, ponPortsResult.error, cablesResult.error,
    coresResult.error, splittersResult.error, outputsResult.error, onusResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  // Fetch customers for ONUs
  const onus = onusResult.data || [];
  const customerIds = [...new Set(onus.map((o) => o.customer_id).filter(Boolean))] as string[];
  const customersResult = customerIds.length > 0
    ? await db.from("customers").select("id, name, customer_id").in("id", customerIds)
    : { data: [], error: null };
  if (customersResult.error) throw customersResult.error;

  const customersById = new Map(
    (customersResult.data || []).map((c) => [c.id, { id: c.id, name: c.name || "", customer_id: c.customer_id || "" } satisfies FiberCustomer]),
  );

  // Build lookup maps
  const onusByOutputId = new Map<string, FiberOnuData>();
  onus.forEach((onu) => {
    if (!onu.splitter_output_id) return;
    onusByOutputId.set(onu.splitter_output_id, {
      id: onu.id, serial_number: onu.serial_number,
      mac_address: onu.mac_address || "", status: onu.status || "active",
      customer_id: onu.customer_id || "",
      customer: onu.customer_id ? customersById.get(onu.customer_id) : undefined,
    });
  });

  const outputsBySplitterId = new Map<string, RawOutput[]>();
  (outputsResult.data || []).forEach((o) => {
    const current = outputsBySplitterId.get(o.splitter_id) || [];
    current.push(o as RawOutput);
    outputsBySplitterId.set(o.splitter_id, current);
  });

  const splittersById = new Map<string, RawSplitter>();
  const splittersByCoreId = new Map<string, string>(); // core_id -> splitter_id
  const splittersBySourceId = new Map<string, RawSplitter>(); // output_id -> splitter (for splitter_output source)
  (splittersResult.data || []).forEach((s) => {
    const raw = s as unknown as RawSplitter;
    splittersById.set(raw.id, raw);
    if (raw.core_id) splittersByCoreId.set(raw.core_id, raw.id);
    if (raw.source_type === "splitter_output" && raw.source_id) {
      splittersBySourceId.set(raw.source_id, raw);
    }
  });

  const coresByCableId = new Map<string, RawCore[]>();
  (coresResult.data || []).forEach((c) => {
    const current = coresByCableId.get(c.fiber_cable_id) || [];
    current.push(c as RawCore);
    coresByCableId.set(c.fiber_cable_id, current);
  });

  // Cables indexed by pon_port_id (traditional) and by source_id (chained)
  const cablesByPortId = new Map<string, RawCable[]>();
  const cablesBySourceId = new Map<string, RawCable[]>(); // output_id -> cables
  (cablesResult.data || []).forEach((cable) => {
    const raw = cable as unknown as RawCable;
    if (raw.pon_port_id) {
      const current = cablesByPortId.get(raw.pon_port_id) || [];
      current.push(raw);
      cablesByPortId.set(raw.pon_port_id, current);
    }
    if (raw.source_type === "splitter" && raw.source_id) {
      const current = cablesBySourceId.get(raw.source_id) || [];
      current.push(raw);
      cablesBySourceId.set(raw.source_id, current);
    }
  });

  const portsByOltId = new Map<string, PonPort[]>();
  (ponPortsResult.data || []).forEach((port) => {
    const visited = new Set<string>();
    const portCables = (cablesByPortId.get(port.id) || []).map((cable) =>
      buildCableNode(cable, coresByCableId, splittersByCoreId, splittersById, outputsBySplitterId, onusByOutputId, cablesBySourceId, splittersBySourceId, splittersByCoreId, visited)
    );

    const normalizedPort: PonPort = {
      id: port.id, port_number: port.port_number,
      status: port.status || "active", cables: portCables,
    };
    const current = portsByOltId.get(port.olt_id) || [];
    current.push(normalizedPort);
    portsByOltId.set(port.olt_id, current);
  });

  return (oltsResult.data || []).map((olt) => ({
    id: olt.id, name: olt.name, location: olt.location || "",
    total_pon_ports: olt.total_pon_ports, status: olt.status || "active",
    lat: olt.lat ?? undefined, lng: olt.lng ?? undefined,
    pon_ports: sortByNumber(portsByOltId.get(olt.id) || [], (p) => p.port_number),
  }));
}

export async function fetchFiberSpliceCountFromSupabase(): Promise<number> {
  const tenantId = await resolveFiberTenantId();
  if (!tenantId) return 0;
  const { count, error } = await db
    .from("core_connections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return count || 0;
}

// ─── Stats helpers ───────────────

function collectAllFromTree(tree: OltData[]) {
  const cables: FiberCableData[] = [];
  const cores: FiberCoreData[] = [];
  const splitters: Splitter[] = [];
  const outputs: SplitterOutput[] = [];
  const onus: FiberOnuData[] = [];

  function walkCables(cableList: FiberCableData[]) {
    cableList.forEach((cable) => {
      cables.push(cable);
      cable.cores.forEach((core) => {
        cores.push(core);
        if (core.splitter) walkSplitter(core.splitter);
      });
    });
  }

  function walkSplitter(splitter: Splitter) {
    splitters.push(splitter);
    splitter.outputs.forEach((output) => {
      outputs.push(output);
      if (output.onu) onus.push(output.onu);
      if (output.child_cables) walkCables(output.child_cables);
      if (output.child_splitter) walkSplitter(output.child_splitter);
    });
  }

  tree.forEach((olt) => {
    olt.pon_ports.forEach((port) => walkCables(port.cables));
  });

  return { cables, cores, splitters, outputs, onus };
}

export function buildFiberStatsFromTree(tree: OltData[], spliceCount = 0): Stats {
  const { cables, cores, splitters, outputs, onus } = collectAllFromTree(tree);
  return {
    total_olts: tree.length,
    total_cables: cables.length,
    total_cores: cores.length,
    free_cores: cores.filter((c) => c.status === "free").length,
    used_cores: cores.filter((c) => c.status !== "free").length,
    total_splitters: splitters.length,
    total_outputs: outputs.length,
    free_outputs: outputs.filter((o) => o.status === "free").length,
    used_outputs: outputs.filter((o) => o.status !== "free").length,
    total_onus: onus.length,
    total_splices: spliceCount,
  };
}

export function buildFiberMapMarkersFromTree(tree: OltData[]): FiberMapMarker[] {
  const markers: FiberMapMarker[] = [];

  function walkSplitter(splitter: Splitter, cableName?: string) {
    if (typeof splitter.lat === "number" && typeof splitter.lng === "number") {
      markers.push({
        id: splitter.id, type: "splitter",
        name: `${splitter.label || "Splitter"} (${splitter.ratio})`,
        lat: splitter.lat, lng: splitter.lng, cable: cableName,
      });
    }
    splitter.outputs.forEach((output) => {
      if (output.child_cables) {
        output.child_cables.forEach((cable) => walkCable(cable));
      }
      if (output.child_splitter) walkSplitter(output.child_splitter);
    });
  }

  function walkCable(cable: FiberCableData) {
    cable.cores.forEach((core) => {
      if (core.splitter) walkSplitter(core.splitter, cable.name);
    });
  }

  tree.forEach((olt) => {
    if (typeof olt.lat === "number" && typeof olt.lng === "number") {
      markers.push({ id: olt.id, type: "olt", name: olt.name, lat: olt.lat, lng: olt.lng });
    }
    olt.pon_ports.forEach((port) => port.cables.forEach((cable) => walkCable(cable)));
  });

  return markers;
}

export function searchFiberTopologyTree(tree: OltData[], query: string): FiberSearchResult[] {
  const needle = safeString(query).toLowerCase();
  if (needle.length < 2) return [];
  const results: FiberSearchResult[] = [];

  function walkSplitter(splitter: Splitter) {
    if ((splitter.label || "").toLowerCase().includes(needle)) {
      results.push({ type: "Splitter", id: splitter.id, label: splitter.label || splitter.ratio });
    }
    splitter.outputs.forEach((output) => {
      if (output.onu && (
        output.onu.serial_number.toLowerCase().includes(needle) ||
        (output.onu.mac_address || "").toLowerCase().includes(needle)
      )) {
        results.push({ type: "ONU", id: output.onu.id, label: output.onu.serial_number });
      }
      if (output.child_cables) output.child_cables.forEach((c) => walkCable(c));
      if (output.child_splitter) walkSplitter(output.child_splitter);
    });
  }

  function walkCable(cable: FiberCableData) {
    if (cable.name.toLowerCase().includes(needle)) {
      results.push({ type: "Cable", id: cable.id, label: cable.name });
    }
    cable.cores.forEach((core) => {
      const coreLabel = `${cable.name} → Core ${core.core_number} (${core.color || "N/A"})`;
      if ((core.color || "").toLowerCase().includes(needle) || coreLabel.toLowerCase().includes(needle)) {
        results.push({ type: "Core", id: core.id, label: coreLabel });
      }
      if (core.splitter) walkSplitter(core.splitter);
    });
  }

  tree.forEach((olt) => {
    if (olt.name.toLowerCase().includes(needle)) {
      results.push({ type: "OLT", id: olt.id, label: olt.name });
    }
    olt.pon_ports.forEach((port) => port.cables.forEach((cable) => walkCable(cable)));
  });

  return results.slice(0, 20);
}

// ─── Collect all free outputs (recursive) ───────────────

export interface FreeOutputItem {
  id: string;
  output_number: number;
  color?: string;
  splitterRatio?: string;
  coreNumber?: number;
  cableName?: string;
  coreColor?: string;
  path: string; // Human-readable path
}

export function collectAllFreeOutputs(tree: OltData[]): FreeOutputItem[] {
  const results: FreeOutputItem[] = [];

  function walkSplitter(splitter: Splitter, pathPrefix: string) {
    splitter.outputs.forEach((output) => {
      if (output.status === "free") {
        results.push({
          id: output.id, output_number: output.output_number, color: output.color,
          splitterRatio: splitter.ratio,
          path: `${pathPrefix} → (${splitter.ratio}) → আউটপুট ${output.output_number}`,
        });
      }
      // Walk deeper
      if (output.child_cables) {
        output.child_cables.forEach((cable) => walkCable(cable, `${pathPrefix} → (${splitter.ratio}) → আউটপুট ${output.output_number}`));
      }
      if (output.child_splitter) {
        walkSplitter(output.child_splitter, `${pathPrefix} → (${splitter.ratio}) → আউটপুট ${output.output_number}`);
      }
    });
  }

  function walkCable(cable: FiberCableData, pathPrefix: string) {
    cable.cores.forEach((core) => {
      if (core.splitter) {
        walkSplitter(core.splitter, `${pathPrefix} → ${cable.name} → কোর ${core.core_number}`);
      }
    });
  }

  tree.forEach((olt) => {
    olt.pon_ports.forEach((port) => {
      port.cables.forEach((cable) => {
        cable.cores.forEach((core) => {
          if (core.splitter) {
            walkSplitter(core.splitter, `${olt.name} → ${cable.name} → কোর ${core.core_number}`);
          }
        });
      });
    });
  });

  return results;
}

// ─── Create functions ───────────────

export async function createFiberOltInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const totalPonPorts = Math.max(1, Number(payload.total_pon_ports) || 1);

  const { data: olt, error } = await db
    .from("fiber_olts")
    .insert({
      tenant_id: tenantId,
      name: safeString(payload.name),
      location: nullableString(payload.location),
      total_pon_ports: totalPonPorts,
      status: nullableString(payload.status) || "active",
      lat: nullableNumber(payload.lat),
      lng: nullableNumber(payload.lng),
    })
    .select()
    .single();

  if (error) throw error;

  const portsToInsert = Array.from({ length: totalPonPorts }, (_, index) => ({
    tenant_id: tenantId, olt_id: olt.id,
    port_number: index + 1, status: "active",
  }));

  const { data: ponPorts, error: portsError } = await db
    .from("fiber_pon_ports").insert(portsToInsert).select();
  if (portsError) throw portsError;

  return {
    id: olt.id, name: olt.name, location: olt.location || "",
    total_pon_ports: olt.total_pon_ports, status: olt.status || "active",
    lat: olt.lat ?? undefined, lng: olt.lng ?? undefined,
    pon_ports: sortByNumber(ponPorts || [], (p) => p.port_number).map((port) => ({
      id: port.id, port_number: port.port_number,
      status: port.status || "active", cables: [],
    })),
  } satisfies OltData;
}

export async function createFiberCableInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const totalCores = Math.max(1, Number(payload.total_cores) || 1);
  const sourceType = safeString(payload.source_type) || "olt";
  const sourceId = nullableString(payload.source_id);

  // If from splitter output, mark the output as used
  if (sourceType === "splitter" && sourceId) {
    await db.from("fiber_splitter_outputs")
      .update({ status: "used", connection_type: "fiber" })
      .eq("tenant_id", tenantId).eq("id", sourceId);
  }

  const { data: cable, error } = await db
    .from("fiber_cables")
    .insert({
      tenant_id: tenantId,
      pon_port_id: nullableString(payload.pon_port_id),
      name: safeString(payload.name),
      total_cores: totalCores,
      color: nullableString(payload.color),
      length_meters: nullableNumber(payload.length_meters),
      status: nullableString(payload.status) || "active",
      source_type: sourceType,
      source_id: sourceId,
    })
    .select()
    .single();

  if (error) throw error;

  // Update connected_id on the output
  if (sourceType === "splitter" && sourceId) {
    await db.from("fiber_splitter_outputs")
      .update({ connected_id: cable.id })
      .eq("tenant_id", tenantId).eq("id", sourceId);
  }

  const coresFromPayload = Array.isArray(payload.cores) ? payload.cores : null;
  const coresToInsert = coresFromPayload && coresFromPayload.length > 0
    ? coresFromPayload.map((core: any) => ({
        tenant_id: tenantId, fiber_cable_id: cable.id,
        core_number: Number(core?.number) || 1,
        color: nullableString(core?.color), status: "free",
      }))
    : Array.from({ length: totalCores }, (_, index) => ({
        tenant_id: tenantId, fiber_cable_id: cable.id,
        core_number: index + 1,
        color: DEFAULT_FIBER_COLORS[index % DEFAULT_FIBER_COLORS.length],
        status: "free",
      }));

  const { error: coresError } = await db.from("fiber_cores").insert(coresToInsert);
  if (coresError) throw coresError;

  return cable;
}

export async function createFiberSplitterInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const coreId = nullableString(payload.core_id);
  const sourceType = safeString(payload.source_type) || "core";
  const sourceId = nullableString(payload.source_id);

  // Validate: must have either core_id or splitter_output source
  if (!coreId && sourceType !== "splitter_output") {
    throw new Error("Either core or splitter output source is required");
  }

  // If from core, check existing
  if (coreId) {
    const { data: existing } = await db
      .from("fiber_splitters").select("id")
      .eq("tenant_id", tenantId).eq("core_id", coreId).maybeSingle();
    if (existing) throw new Error("This core already has a splitter assigned.");

    await db.from("fiber_cores")
      .update({ status: "used" })
      .eq("tenant_id", tenantId).eq("id", coreId);
  }

  // If from splitter output, mark it used
  if (sourceType === "splitter_output" && sourceId) {
    await db.from("fiber_splitter_outputs")
      .update({ status: "used", connection_type: "splitter" })
      .eq("tenant_id", tenantId).eq("id", sourceId);
  }

  const ratio = safeString(payload.ratio) || "1:8";
  const { data: splitter, error } = await db
    .from("fiber_splitters")
    .insert({
      tenant_id: tenantId,
      core_id: coreId,
      ratio,
      location: nullableString(payload.location),
      label: nullableString(payload.label),
      status: nullableString(payload.status) || "active",
      lat: nullableNumber(payload.lat),
      lng: nullableNumber(payload.lng),
      source_type: sourceType,
      source_id: sourceId,
    })
    .select()
    .single();

  if (error) throw error;

  // Update connected_id on the output
  if (sourceType === "splitter_output" && sourceId) {
    await db.from("fiber_splitter_outputs")
      .update({ connected_id: splitter.id })
      .eq("tenant_id", tenantId).eq("id", sourceId);
  }

  const outputCount = Number(ratio.split(":")[1]) || 8;
  const payloadColors = Array.isArray(payload.output_colors) ? payload.output_colors : [];
  const outputsToInsert = Array.from({ length: outputCount }, (_, index) => ({
    tenant_id: tenantId, splitter_id: splitter.id,
    output_number: index + 1, status: "free",
    color: nullableString(payloadColors[index]) || DEFAULT_FIBER_COLORS[index % DEFAULT_FIBER_COLORS.length],
  }));

  const { error: outputsError } = await db.from("fiber_splitter_outputs").insert(outputsToInsert);
  if (outputsError) throw outputsError;

  return splitter;
}

export async function createFiberOnuInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const splitterOutputId = safeString(payload.splitter_output_id);
  if (!splitterOutputId) throw new Error("Splitter output is required");

  const { data: existingOnu } = await db
    .from("fiber_onus").select("id")
    .eq("tenant_id", tenantId).eq("splitter_output_id", splitterOutputId).maybeSingle();
  if (existingOnu) throw new Error("This splitter output already has an ONU assigned.");

  await db.from("fiber_splitter_outputs")
    .update({ status: "used", connection_type: "onu" })
    .eq("tenant_id", tenantId).eq("id", splitterOutputId);

  const { data: onu, error } = await db
    .from("fiber_onus")
    .insert({
      tenant_id: tenantId,
      splitter_output_id: splitterOutputId,
      serial_number: safeString(payload.serial_number),
      mac_address: nullableString(payload.mac_address),
      customer_id: nullableString(payload.customer_id),
      status: nullableString(payload.status) || "active",
      signal_strength: nullableString(payload.signal_strength),
    })
    .select()
    .single();

  if (error) throw error;
  return onu;
}

export async function createFiberSpliceInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const fromCoreId = safeString(payload.from_core_id);
  const toCoreId = safeString(payload.to_core_id);
  if (!fromCoreId || !toCoreId) throw new Error("Both cores are required");
  if (fromCoreId === toCoreId) throw new Error("Cannot splice a core to itself.");

  const [directResult, reverseResult] = await Promise.all([
    db.from("core_connections").select("id").eq("tenant_id", tenantId).eq("from_core_id", fromCoreId).eq("to_core_id", toCoreId).maybeSingle(),
    db.from("core_connections").select("id").eq("tenant_id", tenantId).eq("from_core_id", toCoreId).eq("to_core_id", fromCoreId).maybeSingle(),
  ]);
  if (directResult.error) throw directResult.error;
  if (reverseResult.error) throw reverseResult.error;
  if (directResult.data || reverseResult.data) throw new Error("These cores are already spliced.");

  const { data: splice, error } = await db
    .from("core_connections")
    .insert({
      tenant_id: tenantId, from_core_id: fromCoreId,
      to_core_id: toCoreId, label: nullableString(payload.label),
    })
    .select()
    .single();

  if (error) throw error;
  return splice;
}

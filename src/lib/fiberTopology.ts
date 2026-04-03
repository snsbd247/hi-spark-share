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
  onu?: FiberOnuData;
}

export interface Splitter {
  id: string;
  ratio: string;
  location: string;
  label: string;
  status: string;
  lat?: number;
  lng?: number;
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
  "Blue",
  "Orange",
  "Green",
  "Brown",
  "Slate",
  "White",
  "Red",
  "Black",
  "Yellow",
  "Violet",
  "Rose",
  "Aqua",
];

export const EMPTY_FIBER_STATS: Stats = {
  total_olts: 0,
  total_cables: 0,
  total_cores: 0,
  free_cores: 0,
  used_cores: 0,
  total_splitters: 0,
  total_outputs: 0,
  free_outputs: 0,
  used_outputs: 0,
  total_onus: 0,
  total_splices: 0,
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

    if (currentUser?.tenant_id) {
      return currentUser.tenant_id;
    }

    if (!currentUser?.id) {
      return null;
    }

    const { data, error } = await db
      .from("profiles")
      .select("tenant_id")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.tenant_id ?? null;
  } catch {
    return null;
  }
}

async function requireFiberTenantId() {
  const tenantId = await resolveFiberTenantId();

  if (!tenantId) {
    throw new Error("Tenant context not found");
  }

  return tenantId;
}

export async function fetchFiberTopologyTreeFromSupabase(): Promise<OltData[]> {
  const tenantId = await resolveFiberTenantId();

  if (!tenantId) {
    return [];
  }

  const [
    oltsResult,
    ponPortsResult,
    cablesResult,
    coresResult,
    splittersResult,
    outputsResult,
    onusResult,
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
    oltsResult.error,
    ponPortsResult.error,
    cablesResult.error,
    coresResult.error,
    splittersResult.error,
    outputsResult.error,
    onusResult.error,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const onus = onusResult.data || [];
  const customerIds = [...new Set(onus.map((onu) => onu.customer_id).filter(Boolean))] as string[];
  const customersResult = customerIds.length > 0
    ? await db.from("customers").select("id, name, customer_id").in("id", customerIds)
    : { data: [], error: null };

  if (customersResult.error) {
    throw customersResult.error;
  }

  const customersById = new Map(
    (customersResult.data || []).map((customer) => [
      customer.id,
      {
        id: customer.id,
        name: customer.name || "",
        customer_id: customer.customer_id || "",
      } satisfies FiberCustomer,
    ]),
  );

  const onusByOutputId = new Map<string, FiberOnuData>();
  onus.forEach((onu) => {
    if (!onu.splitter_output_id) return;

    onusByOutputId.set(onu.splitter_output_id, {
      id: onu.id,
      serial_number: onu.serial_number,
      mac_address: onu.mac_address || "",
      status: onu.status || "active",
      customer_id: onu.customer_id || "",
      customer: onu.customer_id ? customersById.get(onu.customer_id) : undefined,
    });
  });

  const outputsBySplitterId = new Map<string, SplitterOutput[]>();
  (outputsResult.data || []).forEach((output) => {
    const normalizedOutput: SplitterOutput = {
      id: output.id,
      output_number: output.output_number,
      status: output.status || "free",
      color: output.color || undefined,
      connection_type: output.connection_type || undefined,
      onu: onusByOutputId.get(output.id),
    };

    const current = outputsBySplitterId.get(output.splitter_id) || [];
    current.push(normalizedOutput);
    outputsBySplitterId.set(output.splitter_id, current);
  });

  const splittersByCoreId = new Map<string, Splitter>();
  (splittersResult.data || []).forEach((splitter) => {
    splittersByCoreId.set(splitter.core_id, {
      id: splitter.id,
      ratio: splitter.ratio,
      location: splitter.location || "",
      label: splitter.label || "",
      status: splitter.status || "active",
      lat: splitter.lat ?? undefined,
      lng: splitter.lng ?? undefined,
      outputs: sortByNumber(outputsBySplitterId.get(splitter.id) || [], (output) => output.output_number),
    });
  });

  const coresByCableId = new Map<string, FiberCoreData[]>();
  (coresResult.data || []).forEach((core) => {
    const normalizedCore: FiberCoreData = {
      id: core.id,
      core_number: core.core_number,
      color: core.color || "",
      status: core.status || "free",
      connected_olt_port_id: core.connected_olt_port_id || undefined,
      splitter: splittersByCoreId.get(core.id),
    };

    const current = coresByCableId.get(core.fiber_cable_id) || [];
    current.push(normalizedCore);
    coresByCableId.set(core.fiber_cable_id, current);
  });

  const cablesByPortId = new Map<string, FiberCableData[]>();
  (cablesResult.data || []).forEach((cable) => {
    if (!cable.pon_port_id) return;

    const normalizedCable: FiberCableData = {
      id: cable.id,
      name: cable.name,
      total_cores: cable.total_cores,
      color: cable.color || "",
      length_meters: cable.length_meters || 0,
      status: cable.status || "active",
      cores: sortByNumber(coresByCableId.get(cable.id) || [], (core) => core.core_number),
    };

    const current = cablesByPortId.get(cable.pon_port_id) || [];
    current.push(normalizedCable);
    cablesByPortId.set(cable.pon_port_id, current);
  });

  const portsByOltId = new Map<string, PonPort[]>();
  (ponPortsResult.data || []).forEach((port) => {
    const normalizedPort: PonPort = {
      id: port.id,
      port_number: port.port_number,
      status: port.status || "active",
      cables: cablesByPortId.get(port.id) || [],
    };

    const current = portsByOltId.get(port.olt_id) || [];
    current.push(normalizedPort);
    portsByOltId.set(port.olt_id, current);
  });

  return (oltsResult.data || []).map((olt) => ({
    id: olt.id,
    name: olt.name,
    location: olt.location || "",
    total_pon_ports: olt.total_pon_ports,
    status: olt.status || "active",
    lat: olt.lat ?? undefined,
    lng: olt.lng ?? undefined,
    pon_ports: sortByNumber(portsByOltId.get(olt.id) || [], (port) => port.port_number),
  }));
}

export async function fetchFiberSpliceCountFromSupabase(): Promise<number> {
  const tenantId = await resolveFiberTenantId();

  if (!tenantId) {
    return 0;
  }

  const { count, error } = await db
    .from("core_connections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  return count || 0;
}

export function buildFiberStatsFromTree(tree: OltData[], spliceCount = 0): Stats {
  const cables = tree.flatMap((olt) => olt.pon_ports.flatMap((port) => port.cables));
  const cores = cables.flatMap((cable) => cable.cores);
  const splitters = cores.map((core) => core.splitter).filter(Boolean) as Splitter[];
  const outputs = splitters.flatMap((splitter) => splitter.outputs || []);
  const onus = outputs.map((output) => output.onu).filter(Boolean) as FiberOnuData[];

  return {
    total_olts: tree.length,
    total_cables: cables.length,
    total_cores: cores.length,
    free_cores: cores.filter((core) => core.status === "free").length,
    used_cores: cores.filter((core) => core.status !== "free").length,
    total_splitters: splitters.length,
    total_outputs: outputs.length,
    free_outputs: outputs.filter((output) => output.status === "free").length,
    used_outputs: outputs.filter((output) => output.status !== "free").length,
    total_onus: onus.length,
    total_splices: spliceCount,
  };
}

export function buildFiberMapMarkersFromTree(tree: OltData[]): FiberMapMarker[] {
  const markers: FiberMapMarker[] = [];

  tree.forEach((olt) => {
    if (typeof olt.lat === "number" && typeof olt.lng === "number") {
      markers.push({
        id: olt.id,
        type: "olt",
        name: olt.name,
        lat: olt.lat,
        lng: olt.lng,
      });
    }

    olt.pon_ports.forEach((port) => {
      port.cables.forEach((cable) => {
        cable.cores.forEach((core) => {
          if (!core.splitter) return;

          if (typeof core.splitter.lat === "number" && typeof core.splitter.lng === "number") {
            markers.push({
              id: core.splitter.id,
              type: "splitter",
              name: `${core.splitter.label || "Splitter"} (${core.splitter.ratio})`,
              lat: core.splitter.lat,
              lng: core.splitter.lng,
              cable: cable.name,
            });
          }
        });
      });
    });
  });

  return markers;
}

export function searchFiberTopologyTree(tree: OltData[], query: string): FiberSearchResult[] {
  const needle = safeString(query).toLowerCase();

  if (needle.length < 2) {
    return [];
  }

  const results: FiberSearchResult[] = [];

  tree.forEach((olt) => {
    if (olt.name.toLowerCase().includes(needle)) {
      results.push({ type: "OLT", id: olt.id, label: olt.name });
    }

    olt.pon_ports.forEach((port) => {
      port.cables.forEach((cable) => {
        if (cable.name.toLowerCase().includes(needle)) {
          results.push({ type: "Cable", id: cable.id, label: cable.name });
        }

        cable.cores.forEach((core) => {
          const coreLabel = `${cable.name} → Core ${core.core_number} (${core.color || "N/A"})`;
          if ((core.color || "").toLowerCase().includes(needle) || coreLabel.toLowerCase().includes(needle)) {
            results.push({ type: "Core", id: core.id, label: coreLabel });
          }

          core.splitter?.outputs.forEach((output) => {
            if (output.onu && (
              output.onu.serial_number.toLowerCase().includes(needle) ||
              (output.onu.mac_address || "").toLowerCase().includes(needle)
            )) {
              results.push({ type: "ONU", id: output.onu.id, label: output.onu.serial_number });
            }
          });
        });
      });
    });
  });

  return results.slice(0, 20);
}

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

  if (error) {
    throw error;
  }

  const portsToInsert = Array.from({ length: totalPonPorts }, (_, index) => ({
    tenant_id: tenantId,
    olt_id: olt.id,
    port_number: index + 1,
    status: "active",
  }));

  const { data: ponPorts, error: portsError } = await db
    .from("fiber_pon_ports")
    .insert(portsToInsert)
    .select();

  if (portsError) {
    throw portsError;
  }

  return {
    id: olt.id,
    name: olt.name,
    location: olt.location || "",
    total_pon_ports: olt.total_pon_ports,
    status: olt.status || "active",
    lat: olt.lat ?? undefined,
    lng: olt.lng ?? undefined,
    pon_ports: sortByNumber(ponPorts || [], (port) => port.port_number).map((port) => ({
      id: port.id,
      port_number: port.port_number,
      status: port.status || "active",
      cables: [],
    })),
  } satisfies OltData;
}

export async function createFiberCableInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const totalCores = Math.max(1, Number(payload.total_cores) || 1);

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
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const coresFromPayload = Array.isArray(payload.cores) ? payload.cores : null;
  const coresToInsert = coresFromPayload && coresFromPayload.length > 0
    ? coresFromPayload.map((core: any) => ({
        tenant_id: tenantId,
        fiber_cable_id: cable.id,
        core_number: Number(core?.number) || 1,
        color: nullableString(core?.color),
        status: "free",
      }))
    : Array.from({ length: totalCores }, (_, index) => ({
        tenant_id: tenantId,
        fiber_cable_id: cable.id,
        core_number: index + 1,
        color: DEFAULT_FIBER_COLORS[index % DEFAULT_FIBER_COLORS.length],
        status: "free",
      }));

  const { error: coresError } = await db.from("fiber_cores").insert(coresToInsert);

  if (coresError) {
    throw coresError;
  }

  return cable;
}

export async function createFiberSplitterInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const coreId = safeString(payload.core_id);

  if (!coreId) {
    throw new Error("Core is required");
  }

  const { data: existingSplitter, error: existingError } = await db
    .from("fiber_splitters")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("core_id", coreId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingSplitter) {
    throw new Error("This core already has a splitter assigned.");
  }

  const { error: coreUpdateError } = await db
    .from("fiber_cores")
    .update({ status: "used" })
    .eq("tenant_id", tenantId)
    .eq("id", coreId);

  if (coreUpdateError) {
    throw coreUpdateError;
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
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const outputCount = Number(ratio.split(":")[1]) || 8;
  const payloadColors = Array.isArray(payload.output_colors) ? payload.output_colors : [];
  const outputsToInsert = Array.from({ length: outputCount }, (_, index) => ({
    tenant_id: tenantId,
    splitter_id: splitter.id,
    output_number: index + 1,
    status: "free",
    color: nullableString(payloadColors[index]) || DEFAULT_FIBER_COLORS[index % DEFAULT_FIBER_COLORS.length],
  }));

  const { error: outputsError } = await db.from("fiber_splitter_outputs").insert(outputsToInsert);

  if (outputsError) {
    throw outputsError;
  }

  return splitter;
}

export async function createFiberOnuInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const splitterOutputId = safeString(payload.splitter_output_id);

  if (!splitterOutputId) {
    throw new Error("Splitter output is required");
  }

  const { data: existingOnu, error: existingError } = await db
    .from("fiber_onus")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("splitter_output_id", splitterOutputId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingOnu) {
    throw new Error("This splitter output already has an ONU assigned.");
  }

  const { error: outputError } = await db
    .from("fiber_splitter_outputs")
    .update({ status: "used", connection_type: "onu" })
    .eq("tenant_id", tenantId)
    .eq("id", splitterOutputId);

  if (outputError) {
    throw outputError;
  }

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

  if (error) {
    throw error;
  }

  return onu;
}

export async function createFiberSpliceInSupabase(payload: Record<string, unknown>) {
  const tenantId = await requireFiberTenantId();
  const fromCoreId = safeString(payload.from_core_id);
  const toCoreId = safeString(payload.to_core_id);

  if (!fromCoreId || !toCoreId) {
    throw new Error("Both cores are required");
  }

  if (fromCoreId === toCoreId) {
    throw new Error("Cannot splice a core to itself.");
  }

  const [directResult, reverseResult] = await Promise.all([
    db.from("core_connections").select("id").eq("tenant_id", tenantId).eq("from_core_id", fromCoreId).eq("to_core_id", toCoreId).maybeSingle(),
    db.from("core_connections").select("id").eq("tenant_id", tenantId).eq("from_core_id", toCoreId).eq("to_core_id", fromCoreId).maybeSingle(),
  ]);

  if (directResult.error) {
    throw directResult.error;
  }

  if (reverseResult.error) {
    throw reverseResult.error;
  }

  if (directResult.data || reverseResult.data) {
    throw new Error("These cores are already spliced.");
  }

  const { data: splice, error } = await db
    .from("core_connections")
    .insert({
      tenant_id: tenantId,
      from_core_id: fromCoreId,
      to_core_id: toCoreId,
      label: nullableString(payload.label),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return splice;
}
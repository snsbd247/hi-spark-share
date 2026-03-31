import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";

export function useGeoDivisions() {
  return useQuery({
    queryKey: ["geo-divisions"],
    queryFn: async () => {
      const { data, error } = await (db as any).from("geo_divisions").select("*").eq("status", "active").order("name");
      if (error) throw error;
      return data as { id: string; name: string; bn_name?: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useGeoDistricts(divisionId?: string) {
  return useQuery({
    queryKey: ["geo-districts", divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const { data, error } = await (db as any).from("geo_districts").select("*").eq("division_id", divisionId).eq("status", "active").order("name");
      if (error) throw error;
      return data as { id: string; name: string; division_id: string }[];
    },
    enabled: !!divisionId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGeoUpazilas(districtId?: string) {
  return useQuery({
    queryKey: ["geo-upazilas", districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const { data, error } = await (db as any).from("geo_upazilas").select("*").eq("district_id", districtId).eq("status", "active").order("name");
      if (error) throw error;
      return data as { id: string; name: string; district_id: string }[];
    },
    enabled: !!districtId,
    staleTime: 10 * 60 * 1000,
  });
}

// Helper: find division ID by name
export function useGeoDivisionByName(name?: string) {
  return useQuery({
    queryKey: ["geo-division-by-name", name],
    queryFn: async () => {
      if (!name) return null;
      const { data } = await (db as any).from("geo_divisions").select("id, name").eq("name", name).maybeSingle();
      return data as { id: string; name: string } | null;
    },
    enabled: !!name,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGeoDistrictByName(name?: string) {
  return useQuery({
    queryKey: ["geo-district-by-name", name],
    queryFn: async () => {
      if (!name) return null;
      const { data } = await (db as any).from("geo_districts").select("id, name, division_id").eq("name", name).limit(1).maybeSingle();
      return data as { id: string; name: string; division_id: string } | null;
    },
    enabled: !!name,
    staleTime: 10 * 60 * 1000,
  });
}

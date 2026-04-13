import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

interface ServerInfo {
  server_ip: string;
  hostname: string;
}

export function useServerInfo() {
  return useQuery<ServerInfo>({
    queryKey: ["server-info"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/server-info`);
      if (!res.ok) throw new Error("Failed to fetch server info");
      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
  });
}

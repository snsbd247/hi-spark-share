import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Activity, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { IS_LOVABLE } from "@/lib/environment";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(180, 50%, 45%)",
];

export default function ResellerBandwidth() {
  const { reseller } = useResellerAuth();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["reseller-bandwidth", reseller?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (IS_LOVABLE) {
        const { data, error } = await (db as any)
          .from("customer_bandwidth_usages")
          .select("upload_mb, download_mb, total_mb, date, zone_id, reseller_zones(name)")
          .eq("reseller_id", reseller!.id)
          .gte("date", dateFrom)
          .lte("date", dateTo)
          .order("date");
        if (error) throw error;
        return data || [];
      } else {
        const token = sessionStorage.getItem("reseller_session_token");
        const res = await fetch(`${API_BASE_URL}/reseller/bandwidth?date_from=${dateFrom}&date_to=${dateTo}`, {
          headers: { "X-Session-Token": token || "" },
        });
        if (!res.ok) throw new Error("Failed to fetch bandwidth data");
        const data = await res.json();
        return (data || []).map((r: any) => ({
          ...r,
          reseller_zones: r.zone ? { name: r.zone.name } : null,
        }));
      }
    },
    enabled: !!reseller?.id,
  });

  // Aggregate by zone
  const zoneMap = new Map<string, { name: string; upload: number; download: number; total: number }>();
  let grandTotal = 0, grandUpload = 0, grandDownload = 0;

  for (const r of rawData) {
    const zoneName = r.reseller_zones?.name || "Unassigned";
    const zoneId = r.zone_id || "none";
    const existing = zoneMap.get(zoneId) || { name: zoneName, upload: 0, download: 0, total: 0 };
    existing.upload += parseFloat(r.upload_mb) || 0;
    existing.download += parseFloat(r.download_mb) || 0;
    existing.total += parseFloat(r.total_mb) || 0;
    zoneMap.set(zoneId, existing);

    grandTotal += parseFloat(r.total_mb) || 0;
    grandUpload += parseFloat(r.upload_mb) || 0;
    grandDownload += parseFloat(r.download_mb) || 0;
  }

  const barData = Array.from(zoneMap.values()).map((z) => ({
    name: z.name,
    upload: Math.round(z.upload),
    download: Math.round(z.download),
    total: Math.round(z.total),
  }));

  const pieData = barData.map((z) => ({ name: z.name, value: z.total }));

  const topZone = barData.sort((a, b) => b.total - a.total)[0];

  // Daily trend
  const dailyMap = new Map<string, number>();
  for (const r of rawData) {
    const d = r.date;
    dailyMap.set(d, (dailyMap.get(d) || 0) + (parseFloat(r.total_mb) || 0));
  }
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total: Math.round(total) }));

  const peakDay = dailyData.sort((a, b) => b.total - a.total)[0];

  const formatMb = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Bandwidth Analytics
            </h1>
            <p className="text-muted-foreground mt-1">Zone-wise bandwidth usage</p>
          </div>
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Usage</p>
                  <p className="text-xl font-bold text-primary">{formatMb(grandTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Upload</p>
                  <p className="text-xl font-bold">{formatMb(grandUpload)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Download</p>
                  <p className="text-xl font-bold">{formatMb(grandDownload)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Top Zone</p>
                  <p className="text-lg font-bold truncate">{topZone?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{topZone ? formatMb(topZone.total) : ""}</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Zone vs Bandwidth</CardTitle></CardHeader>
                <CardContent>
                  {barData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis tickFormatter={(v) => formatMb(v)} className="text-xs" />
                        <Tooltip formatter={(value: number) => formatMb(value)} />
                        <Bar dataKey="upload" name="Upload" fill="hsl(210, 70%, 55%)" stackId="a" />
                        <Bar dataKey="download" name="Download" fill="hsl(var(--primary))" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Distribution by Zone</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(value: number) => formatMb(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Daily Usage Trend
                  {peakDay && <span className="text-xs font-normal text-muted-foreground ml-2">Peak: {peakDay.date} ({formatMb(peakDay.total)})</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis tickFormatter={(v) => formatMb(v)} className="text-xs" />
                      <Tooltip formatter={(value: number) => formatMb(value)} />
                      <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ResellerLayout>
  );
}

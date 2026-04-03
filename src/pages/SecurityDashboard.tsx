import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { safeFormat } from "@/lib/utils";
import { Shield, Search, Eye, AlertTriangle, Loader2, MapPin, Globe, Monitor, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SecurityDashboard() {
  const { t } = useLanguage();
  const sec = t.security;
  const [tab, setTab] = useState<"suspicious" | "geo" | "audit">("suspicious");
  const [search, setSearch] = useState("");
  const [detailLog, setDetailLog] = useState<any>(null);

  const { data: logins = [], isLoading: loadingLogins } = useQuery({
    queryKey: ["login-histories-security"],
    queryFn: async () => {
      const { data, error } = await db.from("login_histories").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["audit-logs-security"],
    queryFn: async () => {
      const { data, error } = await db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const suspiciousLogins = logins.filter((l: any) => l.is_suspicious);
  const failedLogins = logins.filter((l: any) => l.status === "failed");
  const geoLogins = logins.filter((l: any) => l.country || l.city);

  const stats = [
    { label: sec.suspiciousLogins, value: suspiciousLogins.length, icon: AlertTriangle, color: suspiciousLogins.length > 0 ? "text-destructive" : "text-primary", bg: suspiciousLogins.length > 0 ? "bg-destructive/10" : "bg-primary/10" },
    { label: sec.failedAttempts, value: failedLogins.length, icon: XCircle, color: failedLogins.length > 5 ? "text-destructive" : "text-muted-foreground", bg: failedLogins.length > 5 ? "bg-destructive/10" : "bg-muted" },
    { label: sec.uniqueCountries, value: new Set(geoLogins.map((l: any) => l.country).filter(Boolean)).size, icon: Globe, color: "text-primary", bg: "bg-primary/10" },
    { label: sec.totalLogins30d, value: logins.filter((l: any) => new Date(l.created_at) > new Date(Date.now() - 30 * 86400000)).length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="h-6 w-6" /> {sec.securityDashboard}</h1>
          <p className="text-muted-foreground mt-1">{sec.monitorActivities}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5 pb-4 text-center">
                <div className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center ${s.bg} mb-2`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 border-b border-border pb-2">
          {[
            { key: "suspicious", label: sec.suspiciousLogins, icon: AlertTriangle },
            { key: "geo", label: sec.geoLocation, icon: MapPin },
            { key: "audit", label: sec.fullAuditTrail, icon: Monitor },
          ].map((item) => (
            <Button key={item.key} variant={tab === item.key ? "default" : "ghost"} size="sm" onClick={() => setTab(item.key as any)}>
              <item.icon className="h-4 w-4 mr-1" /> {item.label}
            </Button>
          ))}
        </div>

        {tab === "suspicious" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-destructive" />{sec.suspiciousLoginAttempts} ({suspiciousLogins.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLogins ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : suspiciousLogins.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-primary/30" />
                  <p className="font-medium">{sec.noSuspiciousActivity}</p>
                  <p className="text-sm mt-1">{sec.allLoginsNormal}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.common.date}</TableHead>
                      <TableHead>{sec.ip}</TableHead>
                      <TableHead>{sec.location}</TableHead>
                      <TableHead>{sec.device}</TableHead>
                      <TableHead>{sec.reason}</TableHead>
                      <TableHead>{t.common.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suspiciousLogins.map((l: any) => (
                      <TableRow key={l.id} className="bg-destructive/5">
                        <TableCell className="text-sm">{safeFormat(l.created_at, "dd MMM HH:mm")}</TableCell>
                        <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                        <TableCell className="text-sm">{[l.city, l.country].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell className="text-sm">{l.device || "—"}</TableCell>
                        <TableCell><span className="text-xs text-destructive">{l.suspicious_reason || "Unknown"}</span></TableCell>
                        <TableCell><Badge variant={l.status === "success" ? "default" : "destructive"} className="text-xs">{l.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "geo" && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" />{sec.loginLocations}</CardTitle></CardHeader>
            <CardContent>
              {loadingLogins ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {Object.entries(geoLogins.reduce((acc: any, l: any) => { const c = l.country || "Unknown"; acc[c] = (acc[c] || 0) + 1; return acc; }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).map(([country, count]: any) => (
                      <div key={country} className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-lg font-bold text-foreground">{count}</p>
                        <p className="text-xs text-muted-foreground">{country}</p>
                      </div>
                    ))}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.common.date}</TableHead>
                        <TableHead>{sec.ip}</TableHead>
                        <TableHead>{sec.country}</TableHead>
                        <TableHead>{sec.city}</TableHead>
                        <TableHead>{sec.device}</TableHead>
                        <TableHead>{t.common.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {geoLogins.slice(0, 50).map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm">{safeFormat(l.created_at, "dd MMM HH:mm")}</TableCell>
                          <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                          <TableCell>{l.country || "—"}</TableCell>
                          <TableCell>{l.city || "—"}</TableCell>
                          <TableCell className="text-sm">{l.device || "—"}</TableCell>
                          <TableCell><Badge variant={l.status === "success" ? "default" : "destructive"} className="text-xs">{l.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "audit" && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg">{sec.fullAuditTrail}</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={sec.searchLogs} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAudit ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.common.date}</TableHead>
                      <TableHead>{sec.admin}</TableHead>
                      <TableHead>{sec.action}</TableHead>
                      <TableHead>{sec.module}</TableHead>
                      <TableHead>{sec.table}</TableHead>
                      <TableHead>{sec.ip}</TableHead>
                      <TableHead className="text-right">{t.common.details}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.filter((l: any) => {
                      if (!search) return true;
                      const s = search.toLowerCase();
                      return l.admin_name?.toLowerCase().includes(s) || l.table_name?.toLowerCase().includes(s) || l.module?.toLowerCase().includes(s) || l.ip_address?.includes(s);
                    }).slice(0, 100).map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground">{safeFormat(log.created_at, "dd MMM HH:mm")}</TableCell>
                        <TableCell className="font-medium text-sm">{log.admin_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={log.action === "delete" ? "bg-destructive/10 text-destructive border-destructive/20" : log.action === "create" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{log.module || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
                        <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailLog(log)}><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{sec.auditLogDetails}</DialogTitle></DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">{sec.admin}</p><p className="font-medium">{detailLog.admin_name}</p></div>
                <div><p className="text-muted-foreground">{sec.action}</p><p className="font-medium capitalize">{detailLog.action}</p></div>
                <div><p className="text-muted-foreground">{sec.module}</p><p>{detailLog.module || "—"}</p></div>
                <div><p className="text-muted-foreground">{sec.table}</p><p className="font-mono">{detailLog.table_name}</p></div>
                <div><p className="text-muted-foreground">{sec.ipAddress}</p><p className="font-mono">{detailLog.ip_address || "—"}</p></div>
                <div><p className="text-muted-foreground">{t.common.date}</p><p>{safeFormat(detailLog.created_at, "dd MMM yyyy HH:mm:ss")}</p></div>
              </div>
              {detailLog.user_agent && (
                <div><p className="text-muted-foreground mb-1">{sec.userAgent}</p><p className="text-xs bg-muted rounded p-2 break-all">{detailLog.user_agent}</p></div>
              )}
              <div><p className="text-muted-foreground mb-1">{sec.recordId}</p><p className="font-mono text-xs bg-muted rounded p-2 break-all">{detailLog.record_id}</p></div>
              {detailLog.old_data && (
                <div><p className="text-muted-foreground mb-1">{sec.oldData}</p><pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detailLog.old_data, null, 2)}</pre></div>
              )}
              {detailLog.new_data && (
                <div><p className="text-muted-foreground mb-1">{sec.newData}</p><pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detailLog.new_data, null, 2)}</pre></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

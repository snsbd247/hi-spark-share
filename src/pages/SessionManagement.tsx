import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { safeFormat } from "@/lib/utils";
import { Monitor, Smartphone, Globe, LogOut, Shield, Loader2, MapPin, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SessionManagement() {
  const { t } = useLanguage();
  const sec = t.security;
  const qc = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => {
      const { data, error } = await db.from("admin_sessions").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const currentToken = localStorage.getItem("admin_token");

  const terminateMut = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await db.from("admin_sessions").update({ status: "terminated" }).eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(sec.sessionTerminated); qc.invalidateQueries({ queryKey: ["my-sessions"] }); setConfirmDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const terminateAllMut = useMutation({
    mutationFn: async () => {
      const otherSessions = sessions.filter((s: any) => s.session_token !== currentToken && s.status === "active");
      for (const s of otherSessions) { await db.from("admin_sessions").update({ status: "terminated" }).eq("id", s.id); }
    },
    onSuccess: () => { toast.success(sec.allSessionsTerminated); qc.invalidateQueries({ queryKey: ["my-sessions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const activeSessions = sessions.filter((s: any) => s.status === "active");
  const inactiveSessions = sessions.filter((s: any) => s.status !== "active");

  const getDeviceIcon = (device: string) => {
    if (device?.toLowerCase().includes("mobile") || device?.toLowerCase().includes("phone")) return <Smartphone className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="h-6 w-6" /> {sec.sessionManagement}</h1>
            <p className="text-muted-foreground mt-1">{sec.viewManageSessions}</p>
          </div>
          {activeSessions.length > 1 && (
            <Button variant="destructive" onClick={() => terminateAllMut.mutate()} disabled={terminateAllMut.isPending}>
              {terminateAllMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              {sec.logoutAllOther}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-primary" />{sec.activeSessions} ({activeSessions.length})</CardTitle>
            <CardDescription>{sec.currentlyLoggedIn}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : activeSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{sec.noActiveSessions}</p>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session: any) => {
                  const isCurrent = session.session_token === currentToken;
                  return (
                    <div key={session.id} className={`flex items-center justify-between p-4 rounded-lg border ${isCurrent ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isCurrent ? "bg-primary/10" : "bg-muted"}`}>
                          {getDeviceIcon(session.device_name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{session.device_name || sec.unknownDevice}</span>
                            {isCurrent && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{sec.current}</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{session.browser || sec.unknownBrowser}</span>
                            <span>{session.ip_address}</span>
                            {(session.country || session.city) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[session.city, session.country].filter(Boolean).join(", ")}</span>}
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{safeFormat(session.updated_at, "dd MMM HH:mm")}</span>
                          </div>
                        </div>
                      </div>
                      {!isCurrent && (
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDialog(session.id)}>
                          <LogOut className="h-3.5 w-3.5 mr-1" /> {sec.end}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {inactiveSessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg text-muted-foreground">{sec.recentInactiveSessions} ({inactiveSessions.length})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sec.device}</TableHead>
                    <TableHead>{sec.browser}</TableHead>
                    <TableHead>{sec.ip}</TableHead>
                    <TableHead>{sec.location}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{sec.lastActive}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveSessions.slice(0, 20).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.device_name || sec.unknownDevice}</TableCell>
                      <TableCell className="text-sm">{s.browser || sec.unknownBrowser}</TableCell>
                      <TableCell className="text-xs font-mono">{s.ip_address}</TableCell>
                      <TableCell className="text-sm">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs capitalize">{s.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{safeFormat(s.updated_at, "dd MMM yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />{sec.terminateSession}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{sec.terminateSessionDesc}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => confirmDialog && terminateMut.mutate(confirmDialog)} disabled={terminateMut.isPending}>
              {terminateMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {sec.terminate}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

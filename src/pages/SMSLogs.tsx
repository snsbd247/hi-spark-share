import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageSquare, Send, Users, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import GroupSmsDialog from "@/components/GroupSmsDialog";
import SmsLogDetailDialog from "@/components/sms/SmsLogDetailDialog";
import { rowsToCsv, downloadCsv } from "@/lib/csvExport";
import { safeFormat } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const PAGE_SIZES = [25, 50, 100, 200];

export default function SMSLogs() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const [sendOpen, setSendOpen] = useState(false);
  const [groupSmsOpen, setGroupSmsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsForm, setSmsForm] = useState({ phone: "", message: "" });

  // Filters / pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Detail modal
  const [detailLog, setDetailLog] = useState<any | null>(null);

  const { data: pageData, isLoading, refetch } = useQuery({
    queryKey: ["sms-logs", tenantId, page, perPage, statusFilter, search],
    queryFn: async () => {
      const { IS_LOVABLE } = await import("@/lib/environment");
      if (!IS_LOVABLE) {
        const { default: api } = await import("@/lib/api");
        const params: any = { page, per_page: perPage };
        if (statusFilter !== "all") params.status = statusFilter;
        if (search) params.search = search;
        const { data } = await api.get("/sms/history", { params });
        return {
          rows: data?.data ?? [],
          total: data?.total ?? 0,
          last_page: data?.last_page ?? 1,
        };
      }
      // Lovable preview fallback (Supabase) — paginated with range()
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      let query = db
        .from("sms_logs")
        .select("*, customers(name, customer_id)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (search) query = query.or(`phone.ilike.%${search}%,message.ilike.%${search}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      const total = count ?? 0;
      return { rows: data || [], total, last_page: Math.max(1, Math.ceil(total / perPage)) };
    },
  });

  const logs = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const lastPage = pageData?.last_page ?? 1;

  const handleSend = async () => {
    if (!smsForm.phone.trim() || !smsForm.message.trim()) return;
    setSending(true);
    try {
      const { data, error } = await db.functions.invoke("send-sms", {
        body: { to: smsForm.phone, message: smsForm.message, sms_type: "manual" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data && data.success === false) {
        throw new Error(data.error || data.response || "SMS delivery failed");
      }
      toast.success("SMS sent successfully");
      setSmsForm({ phone: "", message: "" });
      setSendOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "SMS sending failed");
    } finally {
      setSending(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { IS_LOVABLE } = await import("@/lib/environment");
      let allRows: any[] = [];

      if (!IS_LOVABLE) {
        const { default: api } = await import("@/lib/api");
        // Pull up to 5 pages of 200 (max per_page) to keep the export bounded
        const MAX_PAGES = 5;
        const SIZE = 200;
        for (let p = 1; p <= MAX_PAGES; p++) {
          const params: any = { page: p, per_page: SIZE };
          if (statusFilter !== "all") params.status = statusFilter;
          if (search) params.search = search;
          const { data } = await api.get("/sms/history", { params });
          const chunk = data?.data ?? [];
          allRows = allRows.concat(chunk);
          if (chunk.length < SIZE) break;
        }
      } else {
        let query = db
          .from("sms_logs")
          .select("*, customers(name, customer_id)")
          .order("created_at", { ascending: false })
          .limit(1000);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
        if (search) query = query.or(`phone.ilike.%${search}%,message.ilike.%${search}%`);
        const { data, error } = await query;
        if (error) throw error;
        allRows = data || [];
      }

      if (!allRows.length) {
        toast.info("No records to export");
        return;
      }

      const csv = rowsToCsv(allRows, [
        { header: "Time", value: (r) => r.created_at ? safeFormat(r.created_at, "yyyy-MM-dd HH:mm:ss") : "" },
        { header: "Phone", value: (r) => r.phone },
        { header: "Customer", value: (r) => r.customers?.name ?? "" },
        { header: "Type", value: (r) => r.sms_type },
        { header: "Message", value: (r) => r.message },
        { header: "Status", value: (r) => r.status },
        { header: "Segments", value: (r) => r.sms_count ?? 1 },
        { header: "Response", value: (r) => r.response },
      ]);
      const stamp = safeFormat(new Date().toISOString(), "yyyyMMdd-HHmm");
      downloadCsv(`sms-history-${stamp}.csv`, csv);
      toast.success(`Exported ${allRows.length} record(s)`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const resetToFirstPage = () => setPage(1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.sms.title}</h1>
            <p className="text-muted-foreground">{t.sms.recentMessages}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setGroupSmsOpen(true)}>
              <Users className="h-4 w-4 mr-2" /> {t.sms.groupSms}
            </Button>
            <Button onClick={() => setSendOpen(true)}>
              <Send className="h-4 w-4 mr-2" /> {t.sms.sendSms}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> {t.sms.recentMessages}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[160px]">
                <Label className="text-xs text-muted-foreground">{t.common.status}</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); resetToFirstPage(); }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All</option>
                  <option value="sent">sent</option>
                  <option value="failed">failed</option>
                  <option value="pending">pending</option>
                </select>
              </div>
              <div className="flex-1 min-w-[220px]">
                <Label className="text-xs text-muted-foreground">Search (phone / message)</Label>
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetToFirstPage(); }}
                  placeholder="01XXXXXXXXX or text..."
                />
              </div>
              <div className="w-[130px]">
                <Label className="text-xs text-muted-foreground">Page size</Label>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); resetToFirstPage(); }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.common.phone}</TableHead>
                        <TableHead>{t.tickets.customer}</TableHead>
                        <TableHead>{t.sms.smsType}</TableHead>
                        <TableHead>{t.sms.message}</TableHead>
                        <TableHead>{t.common.status}</TableHead>
                        <TableHead>{t.common.date}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow
                          key={log.id}
                          onClick={() => setDetailLog(log)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                          <TableCell>{log.customers?.name || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{log.sms_type}</Badge></TableCell>
                          <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                          <TableCell>
                            <Badge className={log.status === "sent" ? "bg-success/15 text-success dark:bg-success/20 dark:text-success" : "bg-destructive/15 text-destructive"}>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{safeFormat(log.created_at, "dd MMM yyyy HH:mm")}</TableCell>
                        </TableRow>
                      ))}
                      {logs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No SMS records found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination footer */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs text-muted-foreground">
                    Showing page {page} of {lastPage} · {total.toLocaleString()} total record(s)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= lastPage}
                      onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.sms.sendSms}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.sms.phoneNumber}</Label>
              <Input
                value={smsForm.phone}
                onChange={(e) => setSmsForm({ ...smsForm, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div>
              <Label>{t.sms.message}</Label>
              <Textarea
                value={smsForm.message}
                onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })}
                placeholder={t.sms.typeMessage}
              />
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t.sms.sendSms}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <GroupSmsDialog
        open={groupSmsOpen}
        onOpenChange={setGroupSmsOpen}
        onSent={() => refetch()}
      />

      <SmsLogDetailDialog
        log={detailLog}
        tenantName={detailLog?.customers?.name}
        open={!!detailLog}
        onOpenChange={(o) => { if (!o) setDetailLog(null); }}
      />
    </DashboardLayout>
  );
}

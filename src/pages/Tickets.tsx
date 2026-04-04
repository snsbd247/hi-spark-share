import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormat } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ticket, Loader2, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-destructive text-destructive-foreground",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-muted text-muted-foreground",
};

export default function Tickets() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", tenantId],
    queryFn: async () => {
      let query: any = db
        .from("support_tickets")
        .select("*, customers(name, customer_id, phone)")
        .order("created_at", { ascending: false });
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["ticket-replies", viewTicket?.id],
    enabled: !!viewTicket,
    queryFn: async () => {
      const { data, error } = await db
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", viewTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  const handleReply = async () => {
    if (!replyText.trim() || !viewTicket) return;
    setReplying(true);
    try {
      const { error } = await db.from("ticket_replies").insert({
        ticket_id: viewTicket.id,
        sender_type: "admin",
        sender_name: "Admin",
        message: replyText.trim(),
      });
      if (error) throw error;
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", viewTicket.id] });
      toast.success("Reply sent");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReplying(false);
    }
  };

  const updateTicket = async (id: string, updates: Record<string, any>) => {
    try {
      const { error } = await db
        .from("support_tickets")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      if (viewTicket?.id === id) {
        setViewTicket({ ...viewTicket, ...updates });
      }
      toast.success("Ticket updated");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = filterStatus === "all" ? tickets : tickets.filter((t: any) => t.status === filterStatus);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.tickets.title}</h1>
            <p className="text-muted-foreground">{t.portal.supportTicketsDesc}</p>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">{t.tickets.allTickets}</SelectItem>
               <SelectItem value="open">{t.tickets.open}</SelectItem>
               <SelectItem value="in_progress">{t.tickets.inProgress}</SelectItem>
               <SelectItem value="resolved">{t.tickets.resolved}</SelectItem>
               <SelectItem value="closed">{t.tickets.closed}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t.tickets.noTicketsFound}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((ticket: any) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setViewTicket(ticket)}
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_id}</span>
                        <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                        <Badge className={statusColors[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                      </div>
                      <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {ticket.customers?.name} ({ticket.customers?.customer_id}) • {ticket.category} •{" "}
                        {safeFormat(ticket.created_at, "dd MMM yyyy")}
                      </p>
                    </div>
                    <MessageSquare className="h-5 w-5 text-muted-foreground hidden sm:block shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{viewTicket?.ticket_id}</span>
              <span>—</span>
              <span>{viewTicket?.subject}</span>
            </DialogTitle>
          </DialogHeader>

          {viewTicket && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t.tickets.customer}</Label>
                  <p className="font-medium">{viewTicket.customers?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.portal.category}</Label>
                  <p className="font-medium">{viewTicket.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.common.status}</Label>
                  <Select
                    value={viewTicket.status}
                    onValueChange={(v) => updateTicket(viewTicket.id, { status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="open">{t.tickets.open}</SelectItem>
                       <SelectItem value="in_progress">{t.tickets.inProgress}</SelectItem>
                       <SelectItem value="resolved">{t.tickets.resolved}</SelectItem>
                       <SelectItem value="closed">{t.tickets.closed}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.tickets.priority}</Label>
                  <Select
                    value={viewTicket.priority}
                    onValueChange={(v) => updateTicket(viewTicket.id, { priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="low">{t.tickets.low}</SelectItem>
                       <SelectItem value="medium">{t.tickets.medium}</SelectItem>
                       <SelectItem value="high">{t.tickets.high}</SelectItem>
                       <SelectItem value="urgent">{t.portal.urgent}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">{t.tickets.assignTo}</Label>
                  <Select
                    value={viewTicket.assigned_to || "unassigned"}
                    onValueChange={(v) =>
                      updateTicket(viewTicket.id, { assigned_to: v === "unassigned" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t.tickets.unassigned}</SelectItem>
                      {profiles.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Replies Thread */}
              <div className="border rounded-lg">
                <div className="p-3 border-b bg-muted/50">
                  <h4 className="font-medium text-sm">{t.tickets.conversation}</h4>
                </div>
                <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
                  {replies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t.tickets.noRepliesYet}</p>
                  ) : (
                    replies.map((reply: any) => (
                      <div
                        key={reply.id}
                        className={`p-3 rounded-lg text-sm ${
                          reply.sender_type === "admin"
                            ? "bg-primary/10 ml-8"
                            : "bg-muted mr-8"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{reply.sender_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {safeFormat(reply.created_at, "dd MMM yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="text-foreground">{reply.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t flex gap-2">
                  <Textarea
                    placeholder={t.tickets.typeReply}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button onClick={handleReply} disabled={replying || !replyText.trim()} size="icon" className="shrink-0 self-end">
                    {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    updateTicket(viewTicket.id, { status: "closed" });
                    setViewTicket(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> {t.tickets.closeTicket}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

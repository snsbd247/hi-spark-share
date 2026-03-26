import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Loader2, MessageSquare, Send, Ticket } from "lucide-react";
import { toast } from "sonner";
import { ticketsApi } from "@/lib/api";

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

export default function CustomerTickets() {
  const { customer } = useCustomerAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "general", priority: "medium", message: "" });
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["customer-tickets", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["ticket-replies", viewTicket?.id],
    enabled: !!viewTicket,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", viewTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.message.trim() || !customer) return;
    setLoading(true);
    try {
      await ticketsApi.create({
        customer_id: customer.id,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        message: form.message.trim(),
        sender_type: "customer",
        sender_name: customer.name,
      });

      setForm({ subject: "", category: "general", priority: "medium", message: "" });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customer-tickets"] });
      toast.success("Ticket created successfully");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !viewTicket || !customer) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("ticket_replies").insert({
        ticket_id: viewTicket.id,
        sender_type: "customer",
        sender_name: customer.name,
        message: replyText.trim(),
      });
      if (error) throw error;
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", viewTicket.id] });
      toast.success("Reply sent");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
            <p className="text-muted-foreground">Get help from our support team</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Ticket
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No support tickets yet</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Your First Ticket
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket: any) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setViewTicket(ticket)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_id}</span>
                        <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                        <Badge className={statusColors[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                      </div>
                      <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {ticket.category} • {safeFormat(ticket.created_at, "dd MMM yyyy")}
                      </p>
                    </div>
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of your issue"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="connection">Connection Issue</SelectItem>
                    <SelectItem value="speed">Speed Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Describe your issue</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Please provide details about your issue..."
                className="min-h-[100px]"
              />
            </div>
            <Button onClick={handleCreate} disabled={loading || !form.subject.trim() || !form.message.trim()} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <span className="font-mono">{viewTicket?.ticket_id}</span> — {viewTicket?.subject}
            </DialogTitle>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge className={statusColors[viewTicket.status]}>{viewTicket.status.replace("_", " ")}</Badge>
                <Badge className={priorityColors[viewTicket.priority]}>{viewTicket.priority}</Badge>
                <Badge variant="outline">{viewTicket.category}</Badge>
              </div>

              <div className="border rounded-lg">
                <div className="p-3 border-b bg-muted/50">
                  <h4 className="font-medium text-sm">Conversation</h4>
                </div>
                <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
                  {replies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
                  ) : (
                    replies.map((reply: any) => (
                      <div
                        key={reply.id}
                        className={`p-3 rounded-lg text-sm ${
                          reply.sender_type === "customer" ? "bg-muted mr-8" : "bg-primary/10 ml-8"
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
                {viewTicket.status !== "closed" && (
                  <div className="p-3 border-t flex gap-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <Button onClick={handleReply} disabled={loading || !replyText.trim()} size="icon" className="shrink-0 self-end">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

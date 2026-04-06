import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, AlertTriangle, CheckCircle, Clock, CreditCard, Users, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "warning" | "info" | "success" | "error";
  icon: React.ReactNode;
  title: string;
  message: string;
  time: string;
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications-center", tenantId],
    queryFn: async () => {
      const items: Notification[] = [];
      const now = new Date();

      // 1. Overdue bills
      const { data: overdueBills } = await db
        .from("bills")
        .select("id, month, due_date, amount, customers(name)")
        .eq("status", "unpaid")
        .lt("due_date", now.toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(5);

      if (overdueBills?.length) {
        items.push({
          id: "overdue-bills",
          type: "error",
          icon: <AlertTriangle className="h-4 w-4" />,
          title: `${overdueBills.length} Overdue Bill${overdueBills.length > 1 ? "s" : ""}`,
          message: `৳${overdueBills.reduce((s, b) => s + Number(b.amount), 0).toLocaleString()} total overdue amount`,
          time: "now",
        });
      }

      // 2. Bills due this week
      const weekLater = new Date(now);
      weekLater.setDate(now.getDate() + 7);
      const { data: upcomingBills } = await db
        .from("bills")
        .select("id")
        .eq("status", "unpaid")
        .gte("due_date", now.toISOString().split("T")[0])
        .lte("due_date", weekLater.toISOString().split("T")[0]);

      if (upcomingBills?.length) {
        items.push({
          id: "upcoming-bills",
          type: "warning",
          icon: <Clock className="h-4 w-4" />,
          title: `${upcomingBills.length} Bills Due This Week`,
          message: "Send reminders to avoid overdue payments",
          time: "this week",
        });
      }

      // 3. Recent payments (last 24h)
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const { data: recentPayments } = await db
        .from("payments")
        .select("id, amount")
        .gte("paid_at", yesterday.toISOString())
        .eq("status", "completed");

      if (recentPayments?.length) {
        items.push({
          id: "recent-payments",
          type: "success",
          icon: <CreditCard className="h-4 w-4" />,
          title: `${recentPayments.length} Payments Today`,
          message: `৳${recentPayments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()} collected`,
          time: "today",
        });
      }

      // 4. Open tickets
      const { data: openTickets } = await db
        .from("support_tickets")
        .select("id")
        .in("status", ["open", "in_progress"]);

      if (openTickets?.length) {
        items.push({
          id: "open-tickets",
          type: "info",
          icon: <MessageSquare className="h-4 w-4" />,
          title: `${openTickets.length} Open Ticket${openTickets.length > 1 ? "s" : ""}`,
          message: "Require attention from support team",
          time: "active",
        });
      }

      // 5. New customers (last 7 days)
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      const { data: newCustomers } = await db
        .from("customers")
        .select("id")
        .gte("created_at", weekAgo.toISOString());

      if (newCustomers?.length) {
        items.push({
          id: "new-customers",
          type: "success",
          icon: <Users className="h-4 w-4" />,
          title: `${newCustomers.length} New Customer${newCustomers.length > 1 ? "s" : ""}`,
          message: "Registered in the last 7 days",
          time: "this week",
        });
      }

      // 6. Recent activity logs
      const { data: recentLogs } = await db
        .from("activity_logs")
        .select("id, action, module, description, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      recentLogs?.forEach((log: any) => {
        items.push({
          id: `log-${log.id}`,
          type: "info",
          icon: <Bell className="h-4 w-4" />,
          title: `${log.action} — ${log.module}`,
          message: log.description || "",
          time: formatDistanceToNow(new Date(log.created_at), { addSuffix: true }),
        });
      });

      return items;
    },
    refetchInterval: 60_000,
  });

  const typeStyles: Record<string, string> = {
    error: "border-l-destructive bg-destructive/5",
    warning: "border-l-yellow-500 bg-yellow-500/5",
    success: "border-l-green-500 bg-green-500/5",
    info: "border-l-primary bg-primary/5",
  };

  const badgeVariant: Record<string, "destructive" | "secondary" | "default" | "outline"> = {
    error: "destructive",
    warning: "secondary",
    success: "default",
    info: "outline",
  };

  return (
    <Card className="glass-card animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Center
          {notifications.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {notifications.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="px-6 pb-6">
              <div className="rounded-lg border border-border p-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-l-2 ${typeStyles[n.type]} transition-colors hover:bg-muted/30`}
                >
                  <div className="mt-0.5 shrink-0 text-muted-foreground">{n.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                      <Badge variant={badgeVariant[n.type]} className="text-[10px] shrink-0">
                        {n.time}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, Clock, CheckCircle, Users, Zap } from "lucide-react";
import { format, setDate, isAfter, isBefore, addMonths, subDays } from "date-fns";
import { toast } from "@/hooks/use-toast";

type CustomerWithBill = {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  monthly_bill: number;
  due_date_day: number | null;
  connection_status: string;
  status: string;
  latestBill?: {
    id: string;
    month: string;
    amount: number;
    status: string;
    due_date: string | null;
  };
};

function getDueStatus(dueDay: number, billStatus?: string, billDueDate?: string | null) {
  const today = new Date();
  
  if (billStatus === "paid") return "paid";
  
  if (billDueDate) {
    const due = new Date(billDueDate);
    if (isBefore(due, today)) return "overdue";
    const reminderDate = subDays(due, 1);
    if (isBefore(reminderDate, today)) return "due-tomorrow";
    const warningDate = subDays(due, 5);
    if (isBefore(warningDate, today)) return "upcoming";
  }
  
  return "pending";
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
    case "overdue":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
    case "due-tomorrow":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />Due Tomorrow</Badge>;
    case "upcoming":
      return <Badge variant="outline" className="bg-accent text-accent-foreground"><Clock className="h-3 w-3 mr-1" />Upcoming</Badge>;
    default:
      return <Badge variant="outline" className="bg-muted text-muted-foreground">Pending</Badge>;
  }
}

export default function BillingCycleOverview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentMonth = format(new Date(), "yyyy-MM");

  const generateBills = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auto-bill-generate");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["billing-cycle-overview"] });
      toast({ title: "Bills Generated", description: `${data?.generated || 0} new bills created for ${currentMonth}.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing-cycle-overview", currentMonth],
    queryFn: async () => {
      const { data: customers, error: custErr } = await supabase
        .from("customers")
        .select("id, customer_id, name, phone, monthly_bill, due_date_day, connection_status, status")
        .eq("status", "active")
        .order("due_date_day", { ascending: true });
      if (custErr) throw custErr;

      const { data: bills, error: billErr } = await supabase
        .from("bills")
        .select("id, customer_id, month, amount, status, due_date")
        .eq("month", currentMonth);
      if (billErr) throw billErr;

      const billMap = new Map<string, typeof bills[0]>();
      bills?.forEach(b => billMap.set(b.customer_id, b));

      return (customers || []).map(c => ({
        ...c,
        latestBill: billMap.get(c.id),
      })) as CustomerWithBill[];
    },
  });

  // Group by due_date_day
  const grouped = new Map<number, CustomerWithBill[]>();
  data?.forEach(c => {
    const day = c.due_date_day || 1;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(c);
  });
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);

  const stats = {
    total: data?.length || 0,
    paid: data?.filter(c => c.latestBill?.status === "paid").length || 0,
    overdue: data?.filter(c => {
      const s = getDueStatus(c.due_date_day || 1, c.latestBill?.status, c.latestBill?.due_date);
      return s === "overdue";
    }).length || 0,
    noBill: data?.filter(c => !c.latestBill).length || 0,
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Billing Cycle Overview</h1>
        <p className="text-muted-foreground mt-1">Customers grouped by due date for {format(new Date(), "MMMM yyyy")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <div><p className="text-2xl font-bold">{stats.paid}</p><p className="text-xs text-muted-foreground">Paid</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div><p className="text-2xl font-bold">{stats.overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-warning" />
          <div><p className="text-2xl font-bold">{stats.noBill}</p><p className="text-xs text-muted-foreground">No Bill Yet</p></div>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : sortedGroups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No active customers found</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([day, customers]) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{day}</span>
                  Due Date: {day}{day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of each month
                  <Badge variant="secondary" className="ml-auto">{customers.length} customers</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">ID</th>
                        <th className="text-left py-2 px-2 font-medium">Name</th>
                        <th className="text-left py-2 px-2 font-medium">Phone</th>
                        <th className="text-right py-2 px-2 font-medium">Bill</th>
                        <th className="text-center py-2 px-2 font-medium">Status</th>
                        <th className="text-center py-2 px-2 font-medium">Connection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => {
                        const dueStatus = getDueStatus(c.due_date_day || 1, c.latestBill?.status, c.latestBill?.due_date);
                        return (
                          <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2 font-mono text-xs">{c.customer_id}</td>
                            <td className="py-2 px-2 font-medium">{c.name}</td>
                            <td className="py-2 px-2 text-muted-foreground">{c.phone}</td>
                            <td className="py-2 px-2 text-right">৳{Number(c.latestBill?.amount || c.monthly_bill).toLocaleString()}</td>
                            <td className="py-2 px-2 text-center">
                              {c.latestBill ? <StatusBadge status={dueStatus} /> : <Badge variant="outline" className="bg-muted text-muted-foreground">No Bill</Badge>}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Badge variant="outline" className={c.connection_status === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                                {c.connection_status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function SMSLogs() {
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsForm, setSmsForm] = useState({ phone: "", message: "" });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sms-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_logs")
        .select("*, customers(name, customer_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const handleSend = async () => {
    if (!smsForm.phone.trim() || !smsForm.message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-sms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: smsForm.phone,
            message: smsForm.message,
            sms_type: "manual",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("SMS sent successfully");
      setSmsForm({ phone: "", message: "" });
      setSendOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">SMS Logs</h1>
            <p className="text-muted-foreground">View sent SMS messages and send new ones</p>
          </div>
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Send SMS
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Recent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                      <TableCell>{log.customers?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.sms_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                      <TableCell>
                        <Badge className={log.status === "sent" ? "bg-green-100 text-green-800" : "bg-destructive text-destructive-foreground"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Phone Number</Label>
              <Input
                value={smsForm.phone}
                onChange={(e) => setSmsForm({ ...smsForm, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={smsForm.message}
                onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })}
                placeholder="Type your message..."
              />
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send SMS
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

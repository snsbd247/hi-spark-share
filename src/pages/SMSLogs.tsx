import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageSquare, Send, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import GroupSmsDialog from "@/components/GroupSmsDialog";
import { safeFormat } from "@/lib/utils";
import api from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SMSLogs() {
  const { t } = useLanguage();
  const [sendOpen, setSendOpen] = useState(false);
  const [groupSmsOpen, setGroupSmsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsForm, setSmsForm] = useState({ phone: "", message: "" });

  const { data: logs = [], isLoading, refetch } = useQuery({
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
      const { data } = await api.post('/sms/send', {
        to: smsForm.phone,
        message: smsForm.message,
        sms_type: "manual",
      });
      if (data?.error) throw new Error(data.error);
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
            <h1 className="text-2xl font-bold text-foreground">{t.sms.title}</h1>
            <p className="text-muted-foreground">{t.sms.recentMessages}</p>
          </div>
          <div className="flex gap-2">
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
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
                      <TableCell className="text-sm">{safeFormat(log.created_at, "dd MMM yyyy HH:mm")}</TableCell>
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
    </DashboardLayout>
  );
}

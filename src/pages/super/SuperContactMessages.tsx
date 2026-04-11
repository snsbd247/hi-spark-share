import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, Search, Eye, EyeOff, Trash2, MessageSquare, Clock, User, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function SuperContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await db.from("contact_messages").select("*").order("created_at", { ascending: false });
    if (!error && data) setMessages(data as ContactMessage[]);
    setLoading(false);
  };

  useEffect(() => { fetchMessages(); }, []);

  const markRead = async (msg: ContactMessage) => {
    if (!msg.is_read) {
      await db.from("contact_messages").update({ is_read: true }).eq("id", msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
    setSelected(msg);
  };

  const toggleRead = async (id: string, current: boolean) => {
    await db.from("contact_messages").update({ is_read: !current }).eq("id", id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: !current } : m));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, is_read: !current } : null);
  };

  const deleteMsg = async (id: string) => {
    await db.from("contact_messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success("Message deleted");
  };

  const filtered = messages.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.message.toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Contact Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Messages from the landing page contact form
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs">{unreadCount} Unread</Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{messages.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{unreadCount}</p>
          <p className="text-xs text-muted-foreground">Unread</p>
        </CardContent></Card>
        <Card className="hidden sm:block"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{messages.length - unreadCount}</p>
          <p className="text-xs text-muted-foreground">Read</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message list */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No messages found</p>
          ) : filtered.map(msg => (
            <div
              key={msg.id}
              onClick={() => markRead(msg)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                selected?.id === msg.id ? "border-primary bg-primary/5" : "border-border"
              } ${!msg.is_read ? "bg-primary/5 border-primary/30" : "bg-card"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!msg.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <p className="text-sm font-medium text-foreground truncate">{msg.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.email}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1 line-clamp-1">{msg.message}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(msg.created_at), "dd MMM")}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Message detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">Message from {selected.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleRead(selected.id, selected.is_read)}>
                      {selected.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMsg(selected.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{selected.name}</span></div>
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selected.email}</span></div>
                  {selected.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selected.phone}</span></div>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(selected.created_at), "dd MMM yyyy, hh:mm a")}
                  <Badge variant={selected.is_read ? "secondary" : "default"} className="ml-2 text-[10px]">
                    {selected.is_read ? "Read" : "Unread"}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {selected.message}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center min-h-[300px]">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a message to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

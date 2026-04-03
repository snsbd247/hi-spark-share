import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperDomains() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tenant_id: "", domain: "" });

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["super-domains"],
    queryFn: superAdminApi.getDomains,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["super-tenants-list"],
    queryFn: () => superAdminApi.getTenants(),
  });

  const assignMut = useMutation({
    mutationFn: superAdminApi.assignDomain,
    onSuccess: () => { toast.success("Domain assigned"); setShowAdd(false); qc.invalidateQueries({ queryKey: ["super-domains"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: superAdminApi.removeDomain,
    onSuccess: () => { toast.success("Domain removed"); qc.invalidateQueries({ queryKey: ["super-domains"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{sa.domainManagement}</h1>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> {sa.assignDomain}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{sa.assignCustomDomain}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); assignMut.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>{sa.tenant}</Label>
                <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                  <SelectTrigger><SelectValue placeholder={sa.selectTenant} /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{sa.domainName}</Label>
                <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="billing.clientisp.com" required />
              </div>
              <Button type="submit" className="w-full" disabled={assignMut.isPending}>
                {assignMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Assign Domain
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sa.domainName}</TableHead>
                <TableHead>{sa.tenant}</TableHead>
                <TableHead>{sa.primary}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : domains.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.domain}</TableCell>
                  <TableCell>{d.tenant?.name || "—"}</TableCell>
                  <TableCell>{d.is_primary ? <Badge>{sa.primary}</Badge> : "—"}</TableCell>
                  <TableCell>{d.is_verified ? <Badge variant="default">{t.common.status}</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remove this domain?")) removeMut.mutate(d.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

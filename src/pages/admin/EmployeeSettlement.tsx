import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Calculator, Eye } from "lucide-react";
import { format } from "date-fns";
import { SettlementCoaPreview } from "@/components/settlement/SettlementCoaPreview";
import { useBuildVersionGuard } from "@/hooks/useBuildVersionGuard";

export default function EmployeeSettlement() {
  useBuildVersionGuard();
  const qc = useQueryClient();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => (await api.get("/hr/employees")).data,
  });

  const { data: settlementsResp } = useQuery({
    queryKey: ["employee-settlements"],
    queryFn: async () => (await api.get("/employee/settlements?per_page=50")).data,
  });

  const generate = useMutation({
    mutationFn: async (empId: string) =>
      (await api.post("/employee/settlement/generate", { employee_id: empId, month: format(new Date(), "yyyy-MM") })).data,
    onSuccess: () => {
      toast.success("Settlement generated");
      qc.invalidateQueries({ queryKey: ["employee-settlements"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed"),
  });

  const settle = useMutation({
    mutationFn: async ({ id, overrides }: { id: string; overrides: Record<string, string | undefined> }) =>
      (await api.post(`/employee/settlement/${id}/pay`, {
        payment_method: "cash",
        confirmed: true,
        ...overrides,
      })).data,
    onSuccess: () => {
      toast.success("Settlement paid — journal entry posted");
      qc.invalidateQueries({ queryKey: ["employee-settlements"] });
      setPreviewId(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed"),
  });


  const empList = Array.isArray(employees) ? employees : employees?.data || [];
  const settlements = settlementsResp?.data || [];
  const totalPending = settlements.filter((s: any) => s.status === "pending").reduce((sum: number, s: any) => sum + parseFloat(s.net_payable), 0);
  const totalPaid = settlements.filter((s: any) => s.status === "paid").reduce((sum: number, s: any) => sum + parseFloat(s.net_payable), 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" /> Employee Settlement
        </h1>
        <p className="text-muted-foreground mt-1">Generate and settle employee accounts via Chart of Accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Employees</p>
          <p className="text-2xl font-bold flex items-center gap-2"><Users className="h-5 w-5" /> {empList.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Pending Payable</p>
          <p className="text-2xl font-bold text-warning">৳{totalPending.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Paid This Period</p>
          <p className="text-2xl font-bold text-primary">৳{totalPaid.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Employees</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empList.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.employee_id}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>৳{parseFloat(e.salary || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => generate.mutate(e.id)} disabled={generate.isPending}>
                      Generate Settlement
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Settlements</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Earn</TableHead>
                <TableHead>Deduction</TableHead>
                <TableHead>Net Payable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.employee?.name}</TableCell>
                  <TableCell>{s.month || "—"}</TableCell>
                  <TableCell>৳{parseFloat(s.total_earn).toLocaleString()}</TableCell>
                  <TableCell className="text-destructive">৳{parseFloat(s.total_deduction).toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-primary">৳{parseFloat(s.net_payable).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                  <TableCell>
                    {s.status === "pending" && (
                      <Button size="sm" onClick={() => setPreviewId(s.id)} disabled={settle.isPending}>
                        <Eye className="h-4 w-4 mr-1" /> Verify & Settle
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SettlementCoaPreview
        settlementId={previewId}
        open={!!previewId}
        onOpenChange={(v) => !v && setPreviewId(null)}
        isConfirming={settle.isPending}
        onConfirm={(overrides) => previewId && settle.mutate({ id: previewId, overrides })}
      />
    </div>
  );
}

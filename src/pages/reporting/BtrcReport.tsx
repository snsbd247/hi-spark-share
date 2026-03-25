import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDb } from "@/lib/apiDb";

export default function BtrcReport() {
  const { data: customers = [], isLoading } = useQuery({ queryKey: ["customers-btrc"], queryFn: async () => { const { data } = await apiDb.from("customers").select("*"); return data || []; } });
  const { data: packages = [] } = useQuery({ queryKey: ["packages-btrc"], queryFn: async () => { const { data } = await apiDb.from("packages").select("*"); return data || []; } });

  const active = customers.filter((c: any) => c.status === "active").length;
  const inactive = customers.filter((c: any) => c.status !== "active").length;
  const total = customers.length;

  const byArea = customers.reduce((acc: Record<string, number>, c: any) => { acc[c.area] = (acc[c.area] || 0) + 1; return acc; }, {});
  const byPackage = customers.reduce((acc: Record<string, number>, c: any) => { const pkg = packages.find((p: any) => p.id === c.package_id); const name = pkg?.name || "No Package"; acc[name] = (acc[name] || 0) + 1; return acc; }, {});

  return (
    <DashboardLayout>
      <div className="mb-6"><h1 className="text-2xl font-bold">BTRC Compliance Report</h1></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-primary">{total}</div><p className="text-sm text-muted-foreground">Total Subscribers</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{active}</div><p className="text-sm text-muted-foreground">Active Subscribers</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{inactive}</div><p className="text-sm text-muted-foreground">Inactive Subscribers</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Subscribers by Area</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Area</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                <TableBody>{Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([area, count]) => (
                  <TableRow key={area}><TableCell className="font-medium">{area}</TableCell><TableCell className="text-right font-semibold">{count}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Subscribers by Package</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Package</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
              <TableBody>{Object.entries(byPackage).sort((a, b) => b[1] - a[1]).map(([pkg, count]) => (
                <TableRow key={pkg}><TableCell className="font-medium">{pkg}</TableCell><TableCell className="text-right font-semibold">{count}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

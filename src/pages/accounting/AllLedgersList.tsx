import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Users, Truck, Briefcase } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function AllLedgersList() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-ledger", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant(( db as any).from("customers").select("id, customer_id, name, phone, monthly_bill, status"), tenantId);
      return data || [];
    },
  });

  const { data: customerLedger = [] } = useQuery({
    queryKey: ["customer-ledger-summary", tenantId],
    queryFn: async () => {
      const { data } = await ( db as any).from("customer_ledger").select("customer_id, debit, credit");
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-ledger", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant(( db as any).from("suppliers").select("id, name, phone, company, total_due, status"), tenantId);
      return data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-ledger", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant(( db as any).from("employees").select("id, employee_id, name, phone, salary, status"), tenantId);
      return data || [];
    },
  });

  const { data: salarySheets = [] } = useQuery({
    queryKey: ["salary-summary", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant(( db as any).from("salary_sheets").select("employee_id, net_salary, status"), tenantId);
      return data || [];
    },
  });

  // Compute customer balances
  const customerBalances = new Map<string, { debit: number; credit: number }>();
  customerLedger.forEach((entry: any) => {
    const cur = customerBalances.get(entry.customer_id) || { debit: 0, credit: 0 };
    cur.debit += Number(entry.debit || 0);
    cur.credit += Number(entry.credit || 0);
    customerBalances.set(entry.customer_id, cur);
  });

  // Compute employee paid totals
  const employeePaid = new Map<string, number>();
  salarySheets.filter((s: any) => s.status === "paid").forEach((s: any) => {
    employeePaid.set(s.employee_id, (employeePaid.get(s.employee_id) || 0) + Number(s.net_salary));
  });

  const filterBySearch = (items: any[], fields: string[]) =>
    items.filter(item => {
      if (!search) return true;
      const s = search.toLowerCase();
      return fields.some(f => String(item[f] || "").toLowerCase().includes(s));
    });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">All Ledgers List</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Tabs defaultValue="customer">
          <TabsList>
            <TabsTrigger value="customer" className="gap-2"><Users className="h-4 w-4" /> Customer ({customers.length})</TabsTrigger>
            <TabsTrigger value="vendor" className="gap-2"><Truck className="h-4 w-4" /> Vendor ({suppliers.length})</TabsTrigger>
            <TabsTrigger value="employee" className="gap-2"><Briefcase className="h-4 w-4" /> Employee ({employees.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="customer">
            <Card>
              <CardHeader><CardTitle>Customer Ledgers</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Debit</TableHead>
                      <TableHead className="text-right">Total Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterBySearch(customers, ["customer_id", "name", "phone"]).map((c: any) => {
                      const bal = customerBalances.get(c.id) || { debit: 0, credit: 0 };
                      const balance = bal.debit - bal.credit;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">{c.customer_id}</TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.phone}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(bal.debit)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(bal.credit)}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
                            {fmt(balance)} {balance > 0 ? "Dr" : balance < 0 ? "Cr" : ""}
                          </TableCell>
                          <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                          <TableCell className="text-center">
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${c.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {customers.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendor">
            <Card>
              <CardHeader><CardTitle>Vendor / Supplier Ledgers</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterBySearch(suppliers, ["name", "company", "phone"]).map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.company || "—"}</TableCell>
                        <TableCell>{s.phone}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${Number(s.total_due) > 0 ? "text-destructive" : ""}`}>
                          {fmt(Number(s.total_due))}
                        </TableCell>
                        <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/supplier/${s.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {suppliers.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employee">
            <Card>
              <CardHeader><CardTitle>Employee Ledgers</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Monthly Salary</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterBySearch(employees, ["employee_id", "name", "phone"]).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-sm">{e.employee_id}</TableCell>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.phone}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(e.salary))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(employeePaid.get(e.id) || 0)}</TableCell>
                        <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {employees.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

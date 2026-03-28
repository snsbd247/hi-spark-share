import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CustomerInfoCard from "@/components/customers/CustomerInfoCard";
import CustomerView from "@/components/customers/CustomerView";
import CustomerLedger from "@/components/customers/CustomerLedger";
import CustomerForm from "@/components/customers/CustomerForm";
import { generateSalesInvoicePDF } from "@/lib/accountingPdf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Download, Pencil, FileDown, CreditCard, Plus, Trash2 } from "lucide-react";
import { generateApplicationFormPDF } from "@/lib/applicationFormPdf";
import { postSaleToLedger } from "@/lib/ledger";
import { toast } from "sonner";

interface SaleItem { product_id: string; quantity: number; unit_price: number; }

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaleOpen, setEditSaleOpen] = useState(false);
  const [editSaleData, setEditSaleData] = useState<any>(null);
  const [editSaleForm, setEditSaleForm] = useState({ sale_date: "", payment_method: "cash", discount: 0, tax: 0, notes: "" });
  const [editSaleItems, setEditSaleItems] = useState<SaleItem[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, packages(name, speed), mikrotik_routers(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: dueAmount } = useQuery({
    queryKey: ["customer-due", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("amount")
        .eq("customer_id", id!)
        .eq("status", "unpaid");
      if (error) throw error;
      return data?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    },
    enabled: !!id,
  });

  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) return { site_name: "Smart ISP" };
      return data;
    },
  });

  const { data: customerSales = [] } = useQuery({
    queryKey: ["customer-sales", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sales").select("*").eq("customer_id", id).order("sale_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("*");
      return data || [];
    },
  });

  const handleDownloadPDF = async () => {
    if (!customer || !settings) return;
    setGenerating(true);
    try {
      const doc = await generateApplicationFormPDF(customer, customer.packages, settings);
      doc.save(`${customer.customer_id || "customer"}-application-form.pdf`);
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error("Failed to generate form: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadSalePDF = async (s: any) => {
    const { data: sItems } = await (supabase as any).from("sale_items").select("*, products(name)").eq("sale_id", s.id);
    const itemsWithNames = (sItems || []).map((i: any) => ({ ...i, product_name: i.products?.name || "Product" }));
    generateSalesInvoicePDF({ ...s, items: itemsWithNames, invoice_number: s.sale_no });
  };

  const openSaleEdit = async (s: any) => {
    const { data: sItems } = await (supabase as any).from("sale_items").select("*").eq("sale_id", s.id);
    setEditSaleData(s);
    setEditSaleForm({
      sale_date: s.sale_date || "",
      payment_method: s.payment_method || "cash",
      discount: Number(s.discount) || 0,
      tax: Number(s.tax) || 0,
      notes: s.notes || "",
    });
    setEditSaleItems((sItems || []).map((i: any) => ({ product_id: i.product_id, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })));
    if (!sItems || sItems.length === 0) setEditSaleItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
    setEditSaleOpen(true);
  };

  const editSaleMutation = useMutation({
    mutationFn: async () => {
      const subtotal = editSaleItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const total = subtotal - editSaleForm.discount + editSaleForm.tax;
      await (supabase as any).from("sales").update({
        sale_date: editSaleForm.sale_date,
        total,
        discount: editSaleForm.discount,
        tax: editSaleForm.tax,
        payment_method: editSaleForm.payment_method,
        notes: editSaleForm.notes,
        status: Number(editSaleData.paid_amount) >= total ? "completed" : "partial",
      }).eq("id", editSaleData.id);
      await (supabase as any).from("sale_items").delete().eq("sale_id", editSaleData.id);
      await (supabase as any).from("sale_items").insert(editSaleItems.map(i => ({
        sale_id: editSaleData.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price,
      })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-sales", id] });
      setEditSaleOpen(false);
      toast.success("Sale updated");
    },
    onError: () => toast.error("Failed to update sale"),
  });

  const adjustPayment = useMutation({
    mutationFn: async ({ sale, amount, method }: { sale: any; amount: number; method: string }) => {
      const newPaid = Number(sale.paid_amount) + amount;
      const total = Number(sale.total);
      await (supabase as any).from("sales").update({
        paid_amount: newPaid,
        status: newPaid >= total ? "completed" : "partial",
      }).eq("id", sale.id);
      await postSaleToLedger(`${sale.sale_no}-PAY`, 0, amount, method, new Date().toISOString().split("T")[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-sales", id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setPayOpen(false);
      setPayTarget(null);
      toast.success("Payment adjusted");
    },
    onError: () => toast.error("Payment adjustment failed"),
  });

  const saleEditSubtotal = editSaleItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const saleEditTotal = saleEditSubtotal - editSaleForm.discount + editSaleForm.tax;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">Customer not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Customer Profile</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit Customer
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download Application Form
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <CustomerInfoCard customer={customer} dueAmount={dueAmount ?? 0} />

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="sales">Sales History ({customerSales.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="glass-card rounded-xl p-6">
              <CustomerView customer={customer} />
            </div>
          </TabsContent>

          <TabsContent value="ledger">
            <CustomerLedger customerId={customer.id} customerName={customer.name} />
          </TabsContent>

          <TabsContent value="sales">
            <Card>
              <CardHeader><CardTitle>Sales Invoices</CardTitle></CardHeader>
              <CardContent>
                {customerSales.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No sales found for this customer</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerSales.map((s: any) => {
                        const due = Number(s.total) - Number(s.paid_amount);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.sale_no}</TableCell>
                            <TableCell>{s.sale_date}</TableCell>
                            <TableCell className="text-right">৳{Number(s.total).toLocaleString()}</TableCell>
                            <TableCell className="text-right">৳{Number(s.paid_amount).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-destructive">৳{due.toLocaleString()}</TableCell>
                            <TableCell><Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => downloadSalePDF(s)} title="Print"><FileDown className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => openSaleEdit(s)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                                {due > 0 && (
                                  <Button variant="ghost" size="icon" onClick={() => { setPayTarget(s); setPayAmount(due); setPayOpen(true); }} title="Payment">
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <CustomerForm
            customer={customer}
            onSuccess={() => {
              setEditOpen(false);
              queryClient.invalidateQueries({ queryKey: ["customer-profile", id] });
              queryClient.invalidateQueries({ queryKey: ["customer-due", id] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={editSaleOpen} onOpenChange={v => { if (!v) setEditSaleOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Sale - {editSaleData?.sale_no}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); editSaleMutation.mutate(); }} className="space-y-4">
            <div><Label>Date</Label><Input type="date" value={editSaleForm.sale_date} onChange={e => setEditSaleForm({...editSaleForm, sale_date: e.target.value})} /></div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditSaleItems([...editSaleItems, { product_id: "", quantity: 1, unit_price: 0 }])}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              {editSaleItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2">
                  <div className="col-span-5">
                    <Select value={item.product_id} onValueChange={v => {
                      const ni = [...editSaleItems]; ni[i].product_id = v;
                      const p = products.find((p: any) => p.id === v);
                      if (p) ni[i].unit_price = Number(p.sell_price);
                      setEditSaleItems(ni);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => { const ni = [...editSaleItems]; ni[i].quantity = +e.target.value; setEditSaleItems(ni); }} /></div>
                  <div className="col-span-3"><Input type="number" step="0.01" value={item.unit_price} onChange={e => { const ni = [...editSaleItems]; ni[i].unit_price = +e.target.value; setEditSaleItems(ni); }} /></div>
                  <div className="col-span-1 text-right font-medium text-sm py-2">৳{(item.quantity * item.unit_price).toLocaleString()}</div>
                  <div className="col-span-1">{editSaleItems.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setEditSaleItems(editSaleItems.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Discount</Label><Input type="number" step="0.01" value={editSaleForm.discount} onChange={e => setEditSaleForm({...editSaleForm, discount: +e.target.value})} /></div>
              <div><Label>Tax</Label><Input type="number" step="0.01" value={editSaleForm.tax} onChange={e => setEditSaleForm({...editSaleForm, tax: +e.target.value})} /></div>
              <div className="flex items-end"><div className="text-right w-full"><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold">৳{saleEditTotal.toLocaleString()}</p></div></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditSaleOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editSaleMutation.isPending}>Update Sale</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Adjustment Dialog */}
      <Dialog open={payOpen} onOpenChange={v => { if (!v) { setPayOpen(false); setPayTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Payment Adjustment</DialogTitle></DialogHeader>
          {payTarget && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">Invoice:</span> {payTarget.sale_no}</p>
                <p><span className="font-medium">Total:</span> ৳{Number(payTarget.total).toLocaleString()}</p>
                <p><span className="font-medium">Paid:</span> ৳{Number(payTarget.paid_amount).toLocaleString()}</p>
                <p className="text-destructive font-semibold">Due: ৳{(Number(payTarget.total) - Number(payTarget.paid_amount)).toLocaleString()}</p>
              </div>
              <div><Label>Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(+e.target.value)} /></div>
              <div><Label>Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="bkash">bKash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setPayOpen(false); setPayTarget(null); }}>Cancel</Button>
                <Button disabled={payAmount <= 0 || adjustPayment.isPending} onClick={() => adjustPayment.mutate({ sale: payTarget, amount: payAmount, method: payMethod })}>
                  Confirm Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

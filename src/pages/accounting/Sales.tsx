import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { postSaleToLedger, postSalePaymentToLedger } from "@/lib/ledger";
import { generateSalesInvoicePDF } from "@/lib/accountingPdf";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Search, FileDown, Pencil, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SaleItem { product_id: string; quantity: number; unit_price: number; }

export default function Sales() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editSale, setEditSale] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [customerType, setCustomerType] = useState<"walkin" | "existing">("walkin");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    customer_name: "Walk-in Customer", customer_phone: "", sale_date: new Date().toISOString().split("T")[0],
    payment_method: "cash", discount: 0, tax: 0, paid_amount: 0, notes: "",
  });
  const [items, setItems] = useState<SaleItem[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sales").select("*, customers(name, customer_id)").order("sale_date", { ascending: false });
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("*");
      return data || [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list-for-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone, customer_id").order("name");
      return data || [];
    },
  });

  const filteredCustomers = customers.filter((c: any) =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch) ||
    c.customer_id?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const create = useMutation({
    mutationFn: async (formData: any) => {
      const saleItems = formData.items;
      const subtotal = saleItems.reduce((s: number, i: SaleItem) => s + i.quantity * i.unit_price, 0);
      const total = subtotal - formData.discount + formData.tax;

      const { data: lastSale } = await (supabase as any).from("sales").select("sale_no").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const lastNum = lastSale?.sale_no ? parseInt(lastSale.sale_no.replace("INV-", "")) : 0;
      const saleNo = `INV-${String(lastNum + 1).padStart(5, "0")}`;

      const { data: sale, error } = await (supabase as any).from("sales").insert({
        sale_no: saleNo,
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        sale_date: formData.sale_date,
        total,
        discount: formData.discount,
        tax: formData.tax,
        paid_amount: formData.paid_amount,
        payment_method: formData.payment_method,
        notes: formData.notes,
        status: formData.paid_amount >= total ? "completed" : "partial",
      }).select().single();
      if (error) throw error;

      const itemsToInsert = saleItems.map((item: SaleItem) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      const { error: itemsErr } = await (supabase as any).from("sale_items").insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      for (const item of saleItems) {
        const prod = products.find((p: any) => p.id === item.product_id);
        if (prod) {
          await (supabase as any).from("products").update({ stock: Math.max(0, Number(prod.stock) - item.quantity) }).eq("id", item.product_id);
        }
      }

      await postSaleToLedger(saleNo, total, formData.paid_amount, formData.payment_method, formData.sale_date);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Sale created & posted to ledger");
      closeDialog();
    },
    onError: () => toast.error("Failed to create sale"),
  });

  const updateSale = useMutation({
    mutationFn: async (formData: any) => {
      const saleItems: SaleItem[] = formData.items;
      const subtotal = saleItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const total = subtotal - formData.discount + formData.tax;

      await (supabase as any).from("sales").update({
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        sale_date: formData.sale_date,
        total,
        discount: formData.discount,
        tax: formData.tax,
        payment_method: formData.payment_method,
        notes: formData.notes,
        status: Number(formData.editSale.paid_amount) >= total ? "completed" : "partial",
      }).eq("id", formData.editSale.id);

      await (supabase as any).from("sale_items").delete().eq("sale_id", formData.editSale.id);
      const itemsToInsert = saleItems.map((item) => ({
        sale_id: formData.editSale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      await (supabase as any).from("sale_items").insert(itemsToInsert);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sale updated");
      closeDialog();
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

      await postSalePaymentToLedger(sale.sale_no, amount, method, new Date().toISOString().split("T")[0]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Payment adjusted successfully");
      setPayOpen(false);
      setPayTarget(null);
      setPayAmount(0);
    },
    onError: () => toast.error("Payment adjustment failed"),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditSale(null);
    setCustomerType("walkin");
    setSelectedCustomerId("");
    setCustomerSearch("");
    setForm({ customer_name: "Walk-in Customer", customer_phone: "", sale_date: new Date().toISOString().split("T")[0], payment_method: "cash", discount: 0, tax: 0, paid_amount: 0, notes: "" });
    setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const openEdit = async (s: any) => {
    const { data: sItems } = await (supabase as any).from("sale_items").select("*").eq("sale_id", s.id);
    setEditSale(s);
    if (s.customer_id) {
      setCustomerType("existing");
      setSelectedCustomerId(s.customer_id);
    } else {
      setCustomerType("walkin");
      setSelectedCustomerId("");
    }
    setForm({
      customer_name: s.customer_name || "Walk-in Customer",
      customer_phone: s.customer_phone || "",
      sale_date: s.sale_date || "",
      payment_method: s.payment_method || "cash",
      discount: Number(s.discount) || 0,
      tax: Number(s.tax) || 0,
      paid_amount: Number(s.paid_amount),
      notes: s.notes || "",
    });
    setItems((sItems || []).map((i: any) => ({ product_id: i.product_id, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })));
    if (items.length === 0) setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
    setOpen(true);
  };

  const downloadPDF = async (s: any) => {
    const { data: sItems } = await (supabase as any).from("sale_items").select("*, products(name)").eq("sale_id", s.id);
    const itemsWithNames = (sItems || []).map((i: any) => ({ ...i, product_name: i.products?.name || "Product" }));
    generateSalesInvoicePDF({ ...s, items: itemsWithNames, invoice_number: s.sale_no });
  };

  const addItem = () => setItems([...items, { product_id: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[i] as any)[field] = value;
    if (field === "product_id") {
      const prod = products.find((p: any) => p.id === value);
      if (prod) newItems[i].unit_price = Number(prod.sell_price);
    }
    setItems(newItems);
  };

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c: any) => c.id === custId);
    if (cust) {
      setForm({ ...form, customer_name: cust.name, customer_phone: cust.phone || "" });
    }
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal - form.discount + form.tax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.product_id)) { toast.error("Select products"); return; }
    const payload = {
      ...form,
      items,
      customer_id: customerType === "existing" ? selectedCustomerId : null,
    };
    if (editSale) {
      updateSale.mutate({ ...payload, editSale });
    } else {
      create.mutate(payload);
    }
  };

  const filtered = sales.filter((s: any) =>
    s.sale_no?.toLowerCase().includes(search.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales</h1>
            <p className="text-muted-foreground text-sm">Create sales invoices and track revenue</p>
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Sale</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editSale ? "Edit Sale" : "Create Sale"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Customer Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Customer</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={customerType === "walkin" ? "default" : "outline"} size="sm" onClick={() => {
                      setCustomerType("walkin");
                      setSelectedCustomerId("");
                      setForm({ ...form, customer_name: "Walk-in Customer", customer_phone: "" });
                    }}>Walk-in Customer</Button>
                    <Button type="button" variant={customerType === "existing" ? "default" : "outline"} size="sm" onClick={() => setCustomerType("existing")}>
                      Select Customer
                    </Button>
                  </div>
                  {customerType === "existing" ? (
                    <div className="space-y-2">
                      <Input placeholder="Search customer by name, phone, ID..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                      {customerSearch && filteredCustomers.length > 0 && !selectedCustomerId && (
                        <div className="border rounded-md max-h-40 overflow-y-auto bg-background">
                          {filteredCustomers.slice(0, 10).map((c: any) => (
                            <div key={c.id} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex justify-between" onClick={() => {
                              handleCustomerSelect(c.id);
                              setCustomerSearch(c.name);
                            }}>
                              <span>{c.name}</span>
                              <span className="text-muted-foreground">{c.customer_id} • {c.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedCustomerId && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{form.customer_name} ({form.customer_phone})</Badge>
                          <Button type="button" variant="ghost" size="sm" onClick={() => {
                            setSelectedCustomerId("");
                            setCustomerSearch("");
                            setForm({ ...form, customer_name: "", customer_phone: "" });
                          }}>Change</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Name</Label><Input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
                      <div><Label>Phone</Label><Input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} /></div>
                    </div>
                  )}
                </div>

                <div><Label>Date</Label><Input type="date" value={form.sale_date} onChange={e => setForm({...form, sale_date: e.target.value})} /></div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-semibold">Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2">
                      <div className="col-span-5">
                        <Select value={item.product_id} onValueChange={v => updateItem(i, "product_id", v)}>
                          <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                          <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", +e.target.value)} /></div>
                      <div className="col-span-3"><Input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(i, "unit_price", +e.target.value)} /></div>
                      <div className="col-span-1 text-right font-medium text-sm py-2">৳{(item.quantity * item.unit_price).toLocaleString()}</div>
                      <div className="col-span-1">{items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Discount</Label><Input type="number" step="0.01" value={form.discount} onChange={e => setForm({...form, discount: +e.target.value})} /></div>
                  <div><Label>Tax</Label><Input type="number" step="0.01" value={form.tax} onChange={e => setForm({...form, tax: +e.target.value})} /></div>
                  {!editSale && <div><Label>Paid</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({...form, paid_amount: +e.target.value})} /></div>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Payment Method</Label>
                    <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="bkash">bKash</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end"><div className="text-right w-full"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">৳{total.toLocaleString()}</p></div></div>
                </div>

                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={create.isPending || updateSale.isPending}>
                    {editSale ? "Update Sale" : "Create Sale"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
                <div><Label>Payment Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(+e.target.value)} max={Number(payTarget.total) - Number(payTarget.paid_amount)} /></div>
                <div><Label>Payment Method</Label>
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
                  <Button variant="outline" onClick={() => { setPayOpen(false); setPayTarget(null); }}>{t.common.cancel}</Button>
                  <Button disabled={payAmount <= 0 || adjustPayment.isPending} onClick={() => adjustPayment.mutate({ sale: payTarget, amount: payAmount, method: payMethod })}>
                    {adjustPayment.isPending ? "Processing..." : "Confirm Payment"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search sales..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No sales found</TableCell></TableRow>
                ) : filtered.map((s: any) => {
                  const due = Number(s.total) - Number(s.paid_amount);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.sale_no}</TableCell>
                      <TableCell>
                        {s.customers?.name || s.customer_name || "Walk-in"}
                        {s.customers?.customer_id && <span className="text-muted-foreground text-xs ml-1">({s.customers.customer_id})</span>}
                      </TableCell>
                      <TableCell>{s.sale_date}</TableCell>
                      <TableCell className="text-right">৳{Number(s.total).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(s.paid_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">৳{due.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => downloadPDF(s)} title="Download PDF"><FileDown className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          {due > 0 && (
                            <Button variant="ghost" size="icon" onClick={() => { setPayTarget(s); setPayAmount(due); setPayOpen(true); }} title="Adjust Payment">
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

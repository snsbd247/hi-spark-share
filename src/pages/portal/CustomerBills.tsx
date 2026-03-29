import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { fetchCustomerData } from "@/hooks/useCustomerData";
import { generateBillInvoicePDF } from "@/lib/billPdf";
import { supabase } from "@/integrations/supabase/client";
import PortalLayout from "@/components/layout/PortalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CreditCard, Smartphone, Building2, Banknote, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import api from "@/lib/api";

export default function CustomerBills() {
  const { customer } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState("10");

  const { data: bills, isLoading } = useQuery({
    queryKey: ["customer-bills-list", customer?.id],
    queryFn: async () => {
      // First try edge function, fallback to direct Supabase query
      try {
        const result = await fetchCustomerData(customer!.session_token, { include_bills: true });
        if (result.bills && result.bills.length > 0) return result.bills;
      } catch (e) {
        console.log("Edge function bills fetch failed, using direct query");
      }
      // Direct Supabase query as fallback
      const { data } = await supabase
        .from("bills")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("month", { ascending: false });
      return data || [];
    },
    enabled: !!customer?.id,
  });

  // Fetch full customer data for PDF generation
  const { data: fullCustomer } = useQuery({
    queryKey: ["portal-customer-full", customer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("*, packages(name, speed)")
        .eq("id", customer!.id)
        .single();
      return data;
    },
    enabled: !!customer?.id,
  });

  const filteredBills = (bills || []).filter((bill: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const invoiceNo = `INV#${bill.id?.substring(0, 6).toUpperCase()}`;
    return (
      invoiceNo.toLowerCase().includes(q) ||
      bill.month?.includes(q) ||
      String(bill.amount).includes(q)
    );
  });

  const displayBills = filteredBills.slice(0, Number(perPage) || 10);

  const handleDownloadInvoice = async (bill: any) => {
    try {
      await generateBillInvoicePDF(bill, fullCustomer || customer);
      toast.success("Invoice downloaded");
    } catch {
      toast.error("Failed to download invoice");
    }
  };

  const handlePayNow = (bill: any) => {
    setSelectedBill(bill);
    setPayOpen(true);
  };

  const handleBkashPay = async () => {
    if (!selectedBill || !customer) return;
    setPaying(true);
    try {
      const callbackUrl = `${window.location.origin}/portal/payment-callback`;
      const { data } = await api.post("/bkash/create-payment", {
        bill_id: selectedBill.id,
        customer_id: customer.id,
        amount: Number(selectedBill.amount),
        callback_url: callbackUrl,
      });
      if (data.bkashURL) {
        localStorage.setItem("bkash_payment_id", data.paymentID);
        window.location.href = data.bkashURL;
      } else {
        toast.error(data.error || "Failed to initiate payment");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const paymentMethods = [
    { id: "bkash", name: "bKash", icon: Smartphone, color: "text-pink-600", bgColor: "bg-pink-50", available: true, action: handleBkashPay },
    { id: "nagad", name: "Nagad", icon: Smartphone, color: "text-orange-600", bgColor: "bg-orange-50", available: false },
    { id: "bank", name: "Bank Transfer", icon: Building2, color: "text-blue-600", bgColor: "bg-blue-50", available: false },
    { id: "cash", name: "Cash", icon: Banknote, color: "text-green-600", bgColor: "bg-green-50", available: false, note: "Pay at office" },
  ];

  const formatBillDate = (month: string) => {
    try {
      const [yr, mn] = month.split("-").map(Number);
      return format(new Date(yr, mn - 1, 1), "dd MMM yyyy");
    } catch {
      return month;
    }
  };

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Invoice History</h1>
        <p className="text-muted-foreground mt-1">View, download and pay your invoices</p>
      </div>

      <div className="glass-card rounded-xl p-4 sm:p-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Show</span>
            <Select value={perPage} onValueChange={setPerPage}>
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">entries</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-full sm:w-56"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Client Id</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice For</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayBills.map((bill: any) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium text-primary">
                        INV#{bill.id?.substring(0, 6).toUpperCase()}
                      </TableCell>
                      <TableCell>{customer?.customer_id}</TableCell>
                      <TableCell className="text-primary">{formatBillDate(bill.month)}</TableCell>
                      <TableCell className="text-primary">Monthly Bill (MRC)</TableCell>
                      <TableCell className="text-right">{Number(bill.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          bill.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : bill.status === "unpaid"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }>
                          {bill.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download Invoice"
                            onClick={() => handleDownloadInvoice(bill)}
                          >
                            <Download className="h-4 w-4 text-emerald-600" />
                          </Button>
                          {bill.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePayNow(bill)}
                              className="text-xs"
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                              Pay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Entry count */}
        {!isLoading && filteredBills.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            Showing {Math.min(displayBills.length, filteredBills.length)} of {filteredBills.length} entries
          </div>
        )}
      </div>

      {/* Payment Method Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bill Month</span>
                  <span className="font-medium text-foreground">{selectedBill.month}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-lg text-foreground">৳{Number(selectedBill.amount).toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    disabled={!method.available || paying}
                    onClick={method.action}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      method.available
                        ? "hover:border-primary hover:shadow-sm cursor-pointer border-border"
                        : "opacity-50 cursor-not-allowed border-border"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg ${method.bgColor} flex items-center justify-center`}>
                      <method.icon className={`h-5 w-5 ${method.color}`} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium text-sm text-foreground">{method.name}</p>
                      {method.note && <p className="text-xs text-muted-foreground">{method.note}</p>}
                      {!method.available && <p className="text-xs text-muted-foreground">Coming soon</p>}
                    </div>
                    {paying && method.id === "bkash" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

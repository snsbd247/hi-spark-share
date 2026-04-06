import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { fetchCustomerData } from "@/hooks/useCustomerData";
import { generateBillInvoicePDF } from "@/lib/billPdf";
import { db } from "@/integrations/supabase/client";
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
import { useLanguage } from "@/contexts/LanguageContext";

export default function CustomerBills() {
  const { t } = useLanguage();
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
      try {
        const result = await fetchCustomerData(customer!.session_token, { include_bills: true });
        if (result.bills && result.bills.length > 0) return result.bills;
      } catch (e) {
        // Fallback to direct query
      }
      const { data } = await db
        .from("bills")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("month", { ascending: false });
      return data || [];
    },
    enabled: !!customer?.id,
  });

  const { data: fullCustomer } = useQuery({
    queryKey: ["portal-customer-full", customer?.id],
    queryFn: async () => {
      const { data } = await db
        .from("customers")
        .select("*, packages(name, speed)")
        .eq("id", customer!.id)
        .maybeSingle();
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
      toast.success(t.portal.invoiceDownloaded);
    } catch {
      toast.error(t.portal.invoiceDownloadFailed);
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
        toast.error(data.error || t.portal.paymentFailed);
      }
    } catch (err: any) {
      toast.error(err.message || t.portal.paymentFailed);
    } finally {
      setPaying(false);
    }
  };

  const paymentMethods = [
    { id: "bkash", name: "bKash", icon: Smartphone, color: "text-pink-600", bgColor: "bg-pink-50", available: true, action: handleBkashPay },
    { id: "nagad", name: "Nagad", icon: Smartphone, color: "text-orange-600", bgColor: "bg-orange-50", available: false },
    { id: "bank", name: t.portal.bankTransfer, icon: Building2, color: "text-blue-600", bgColor: "bg-blue-50", available: false },
    { id: "cash", name: t.payments.cash, icon: Banknote, color: "text-green-600", bgColor: "bg-green-50", available: false, note: t.portal.payAtOffice },
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
        <h1 className="text-2xl font-bold text-foreground">{t.portal.invoiceHistory}</h1>
        <p className="text-muted-foreground mt-1">{t.portal.invoiceHistoryDesc}</p>
      </div>

      <div className="glass-card rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.table.show}</span>
            <Select value={perPage} onValueChange={setPerPage}>
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">{t.table.entries}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.table.searchPlaceholder}
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
                  <TableHead>{t.portal.serial}</TableHead>
                  <TableHead>{t.portal.clientId}</TableHead>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead>{t.portal.invoiceFor}</TableHead>
                  <TableHead className="text-right">{t.common.amount}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      {t.portal.noInvoicesFound}
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
                      <TableCell className="text-primary">{t.portal.monthlyBillMRC}</TableCell>
                      <TableCell className="text-right">{Number(bill.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          bill.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : bill.status === "unpaid"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }>
                          {bill.status === "paid" ? t.common.paid : bill.status === "unpaid" ? t.common.unpaid : bill.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t.portal.downloadInvoice}
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
                              {t.portal.pay}
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

        {!isLoading && filteredBills.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            {t.table.showing} {Math.min(displayBills.length, filteredBills.length)} {t.table.of} {filteredBills.length} {t.table.entries}
          </div>
        )}
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.portal.choosePaymentMethod}</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t.portal.billMonth}</span>
                  <span className="font-medium text-foreground">{selectedBill.month}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">{t.common.amount}</span>
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
                      {!method.available && <p className="text-xs text-muted-foreground">{t.portal.comingSoon}</p>}
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

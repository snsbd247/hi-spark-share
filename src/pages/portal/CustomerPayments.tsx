import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { safeFormat } from "@/lib/utils";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { fetchCustomerData } from "@/hooks/useCustomerData";
import { supabase } from "@/integrations/supabase/client";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Search } from "lucide-react";
import { generatePaymentReceiptPDF } from "@/lib/pdf";
import { useInvoiceFooter } from "@/hooks/useInvoiceFooter";

export default function CustomerPayments() {
  const { customer } = useCustomerAuth();
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState("10");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["customer-payments", customer?.id],
    queryFn: async () => {
      try {
        const result = await fetchCustomerData(customer!.session_token, { include_payments: true });
        if (result.payments && result.payments.length > 0) return result.payments;
      } catch (e) {
        console.log("Edge function payments fetch failed, using direct query");
      }
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("paid_at", { ascending: false });
      return data || [];
    },
    enabled: !!customer?.id,
  });

  // Fetch full customer for PDF
  const { data: fullCustomer } = useQuery({
    queryKey: ["portal-customer-full-pay", customer?.id],
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

  const { data: invoiceFooter } = useInvoiceFooter();

  const filteredPayments = (payments || []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const serial = `PMT#${p.id?.substring(0, 6).toUpperCase()}`;
    return (
      serial.toLowerCase().includes(q) ||
      (p.payment_method || "").toLowerCase().includes(q) ||
      String(p.amount).includes(q) ||
      (p.month || "").includes(q)
    );
  });

  const displayPayments = filteredPayments.slice(0, Number(perPage) || 10);

  const formatPaymentMethod = (method: string) => {
    const map: Record<string, string> = {
      cash: "Cash",
      bkash: "Bkash",
      nagad: "Nagad",
      bank: "Bank Transfer",
      "brac bank": "Brac Bank",
      "brac_bank": "Brac Bank",
    };
    return map[method?.toLowerCase()] || method || "—";
  };

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
        <p className="text-muted-foreground mt-1">View and download your payment receipts</p>
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
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Money Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No payment history found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium text-primary">
                        PMT#{payment.id?.substring(0, 6).toUpperCase()}
                      </TableCell>
                      <TableCell>{customer?.customer_id}</TableCell>
                      <TableCell>{safeFormat(payment.paid_at, "dd MMM yyyy")}</TableCell>
                      <TableCell>{formatPaymentMethod(payment.payment_method)}</TableCell>
                      <TableCell className="text-right">{Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Download Money Receipt"
                          onClick={() => generatePaymentReceiptPDF(payment, fullCustomer || customer, invoiceFooter)}
                        >
                          <Download className="h-4 w-4 text-emerald-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!isLoading && filteredPayments.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            Showing {Math.min(displayPayments.length, filteredPayments.length)} of {filteredPayments.length} entries
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

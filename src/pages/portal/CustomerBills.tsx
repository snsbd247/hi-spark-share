import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { fetchCustomerData } from "@/hooks/useCustomerData";
import PortalLayout from "@/components/layout/PortalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CreditCard, Smartphone, Building2, Banknote } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function CustomerBills() {
  const { customer } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [paying, setPaying] = useState(false);

  const { data: bills, isLoading } = useQuery({
    queryKey: ["customer-bills-list", customer?.id],
    queryFn: async () => {
      const result = await fetchCustomerData(customer!.session_token, { include_bills: true });
      return result.bills || [];
    },
    enabled: !!customer,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-success/10 text-success border-success/20";
      case "unpaid": return "bg-destructive/10 text-destructive border-destructive/20";
      case "partial": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted text-muted-foreground";
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

      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/bkash-payment/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bill_id: selectedBill.id,
            customer_id: customer.id,
            amount: Number(selectedBill.amount),
            callback_url: callbackUrl,
          }),
        }
      );

      const data = await res.json();

      if (data.bkashURL) {
        // Store paymentID for callback
        localStorage.setItem("bkash_payment_id", data.paymentID);
        // Redirect to bKash
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
    {
      id: "bkash",
      name: "bKash",
      icon: Smartphone,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      available: true,
      action: handleBkashPay,
    },
    {
      id: "nagad",
      name: "Nagad",
      icon: Smartphone,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      available: false,
    },
    {
      id: "bank",
      name: "Bank Transfer",
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      available: false,
    },
    {
      id: "cash",
      name: "Cash",
      icon: Banknote,
      color: "text-green-600",
      bgColor: "bg-green-50",
      available: false,
      note: "Pay at office",
    },
  ];

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Bills</h1>
        <p className="text-muted-foreground mt-1">View and pay your monthly bills</p>
      </div>

      <div className="glass-card rounded-xl">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                      No bills found
                    </TableCell>
                  </TableRow>
                ) : (
                  bills?.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.month}</TableCell>
                      <TableCell>৳{Number(bill.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(bill.status)}>
                          {bill.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {bill.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePayNow(bill)}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay Now
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
                      {method.note && (
                        <p className="text-xs text-muted-foreground">{method.note}</p>
                      )}
                      {!method.available && (
                        <p className="text-xs text-muted-foreground">Coming soon</p>
                      )}
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

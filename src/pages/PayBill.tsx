import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, CreditCard } from "lucide-react";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function PayBill() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [bill, setBill] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBill() {
      if (!token) {
        setError("Invalid payment link");
        setLoading(false);
        return;
      }

      const { data: bills, error: err } = await supabase
        .from("bills")
        .select("*, customers(name, customer_id, phone)")
        .eq("payment_link_token", token)
        .limit(1);

      if (err || !bills?.length) {
        setError("Bill not found or link expired");
        setLoading(false);
        return;
      }

      setBill(bills[0]);
      setCustomer(bills[0].customers);
      setLoading(false);
    }
    fetchBill();
  }, [token]);

  const handleBkash = async () => {
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/bkash-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: bill.amount,
            bill_id: bill.id,
            customer_id: bill.customer_id,
          }),
        }
      );
      const data = await res.json();
      if (data.bkashURL) {
        window.location.href = data.bkashURL;
      } else {
        alert("Could not initiate bKash payment");
      }
    } catch {
      alert("Payment failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center border-b">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Wifi className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl">Smart ISP</CardTitle>
          <p className="text-sm text-muted-foreground">Internet Bill Payment</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Bill Details */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer Name</span>
              <span className="font-medium">{customer?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer ID</span>
              <span className="font-mono">{customer?.customer_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bill Month</span>
              <span className="font-medium">{bill?.month}</span>
            </div>
            {bill?.due_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">{new Date(bill.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Amount</span>
              <span className="text-2xl font-bold text-primary">৳{Number(bill?.amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-center">
              <Badge className={bill?.status === "paid"
                ? "bg-green-100 text-green-800"
                : "bg-destructive/10 text-destructive"
              }>
                {bill?.status?.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Payment Buttons */}
          {bill?.status !== "paid" && (
            <div className="space-y-3">
              <Button
                onClick={handleBkash}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                size="lg"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pay with bKash
              </Button>
              <Button
                variant="outline"
                className="w-full border-orange-400 text-orange-600 hover:bg-orange-50"
                size="lg"
                disabled
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pay with Nagad (Coming Soon)
              </Button>
            </div>
          )}

          {bill?.status === "paid" && (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">✓ This bill has already been paid</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CustomerInfoCard from "@/components/customers/CustomerInfoCard";
import CustomerLedger from "@/components/customers/CustomerLedger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, packages(name), mikrotik_routers(name)")
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
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Customer Profile</h1>
      </div>

      <div className="space-y-6">
        <CustomerInfoCard customer={customer} dueAmount={dueAmount ?? 0} />
        <CustomerLedger customerId={customer.id} customerName={customer.name} />
      </div>
    </DashboardLayout>
  );
}

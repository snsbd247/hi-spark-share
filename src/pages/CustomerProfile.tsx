import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CustomerInfoCard from "@/components/customers/CustomerInfoCard";
import CustomerLedger from "@/components/customers/CustomerLedger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Download, FileText } from "lucide-react";
import { generateApplicationFormPDF } from "@/lib/applicationFormPdf";
import { toast } from "sonner";

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

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
          <Button variant="outline" size="sm" onClick={() => navigate(`/customers?edit=${id}`)}>
            <FileText className="h-4 w-4 mr-2" /> Edit Customer
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download Application Form
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <CustomerInfoCard customer={customer} dueAmount={dueAmount ?? 0} />
        <CustomerLedger customerId={customer.id} customerName={customer.name} />
      </div>
    </DashboardLayout>
  );
}

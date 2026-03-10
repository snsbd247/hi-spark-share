import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CustomerInfoCard from "@/components/customers/CustomerInfoCard";
import CustomerView from "@/components/customers/CustomerView";
import CustomerLedger from "@/components/customers/CustomerLedger";
import CustomerForm from "@/components/customers/CustomerForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Download, Pencil } from "lucide-react";
import { generateApplicationFormPDF } from "@/lib/applicationFormPdf";
import { toast } from "sonner";

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
        <div className="glass-card rounded-xl p-6">
          <CustomerView customer={customer} />
        </div>
        <CustomerLedger customerId={customer.id} customerName={customer.name} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
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
    </DashboardLayout>
  );
}

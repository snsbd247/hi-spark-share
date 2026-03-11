import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function InvoiceSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [invoiceFooter, setInvoiceFooter] = useState("Thank you for using our internet service.");

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-footer-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings" as any)
        .select("setting_value")
        .eq("setting_key", "invoice_footer")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.setting_value || "";
    },
  });

  useEffect(() => {
    if (data) setInvoiceFooter(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("system_settings")
        .update({ setting_value: invoiceFooter, updated_at: new Date().toISOString() })
        .eq("setting_key", "invoice_footer");
      if (error) throw error;
      toast.success("Invoice footer saved");
      queryClient.invalidateQueries({ queryKey: ["invoice-footer-setting"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Invoice Footer</CardTitle>
        <CardDescription>This text appears at the bottom of all invoices and payment receipts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Invoice Footer Text</Label>
          <Textarea
            value={invoiceFooter}
            onChange={(e) => setInvoiceFooter(e.target.value)}
            placeholder="Thank you for using our internet service."
            rows={3}
          />
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">Preview:</p>
          <p className="text-sm text-foreground italic">{invoiceFooter || "No footer text set"}</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Invoice Footer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

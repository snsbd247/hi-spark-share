import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Receipt, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InvoiceSettings {
  invoice_footer: string;
  vat_registration_number: string;
  payment_methods_text: string;
  bank_accounts: { bank_name: string; account_no: string }[];
  bkash_merchant: string;
  nagad_merchant: string;
  rocket_biller_id: string;
  visa_card_info: string;
  technical_support_phone: string;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  invoice_footer: "Thank you for using our internet service.",
  vat_registration_number: "",
  payment_methods_text: "Cheque: Account Payee Cheque in favor of \"Your Company Name\"",
  bank_accounts: [{ bank_name: "", account_no: "" }],
  bkash_merchant: "",
  nagad_merchant: "",
  rocket_biller_id: "",
  visa_card_info: "",
  technical_support_phone: "",
};

export default function InvoiceSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-settings-all"],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("system_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "invoice_%");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
      return map;
    },
  });

  useEffect(() => {
    if (data) {
      setSettings({
        invoice_footer: data.invoice_footer || DEFAULT_SETTINGS.invoice_footer,
        vat_registration_number: data.invoice_vat_reg || "",
        payment_methods_text: data.invoice_cheque_text || DEFAULT_SETTINGS.payment_methods_text,
        bank_accounts: data.invoice_bank_accounts ? JSON.parse(data.invoice_bank_accounts) : DEFAULT_SETTINGS.bank_accounts,
        bkash_merchant: data.invoice_bkash_merchant || "",
        nagad_merchant: data.invoice_nagad_merchant || "",
        rocket_biller_id: data.invoice_rocket_biller_id || "",
        visa_card_info: data.invoice_visa_card_info || "",
        technical_support_phone: data.invoice_tech_support || "",
      });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = [
        { setting_key: "invoice_footer", setting_value: settings.invoice_footer },
        { setting_key: "invoice_vat_reg", setting_value: settings.vat_registration_number },
        { setting_key: "invoice_cheque_text", setting_value: settings.payment_methods_text },
        { setting_key: "invoice_bank_accounts", setting_value: JSON.stringify(settings.bank_accounts.filter(b => b.bank_name || b.account_no)) },
        { setting_key: "invoice_bkash_merchant", setting_value: settings.bkash_merchant },
        { setting_key: "invoice_nagad_merchant", setting_value: settings.nagad_merchant },
        { setting_key: "invoice_rocket_biller_id", setting_value: settings.rocket_biller_id },
        { setting_key: "invoice_visa_card_info", setting_value: settings.visa_card_info },
        { setting_key: "invoice_tech_support", setting_value: settings.technical_support_phone },
      ].map(e => ({ ...e, updated_at: new Date().toISOString() }));

      const { error } = await (db as any)
        .from("system_settings")
        .upsert(entries, { onConflict: "setting_key" });
      if (error) throw error;
      toast.success("Invoice settings saved");
      queryClient.invalidateQueries({ queryKey: ["invoice-settings-all"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-footer-setting"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addBank = () => {
    setSettings(s => ({ ...s, bank_accounts: [...s.bank_accounts, { bank_name: "", account_no: "" }] }));
  };

  const removeBank = (i: number) => {
    setSettings(s => ({ ...s, bank_accounts: s.bank_accounts.filter((_, idx) => idx !== i) }));
  };

  const updateBank = (i: number, field: "bank_name" | "account_no", value: string) => {
    setSettings(s => ({
      ...s,
      bank_accounts: s.bank_accounts.map((b, idx) => idx === i ? { ...b, [field]: value } : b),
    }));
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Invoice Footer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-5 w-5" /> Invoice Footer</CardTitle>
          <CardDescription>This text appears at the bottom of all invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={settings.invoice_footer}
            onChange={(e) => setSettings(s => ({ ...s, invoice_footer: e.target.value }))}
            placeholder="Thank you for using our internet service."
            rows={2}
          />
        </CardContent>
      </Card>

      {/* VAT Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">VAT Registration Number</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={settings.vat_registration_number}
            onChange={(e) => setSettings(s => ({ ...s, vat_registration_number: e.target.value }))}
            placeholder="e.g. 18141113186"
          />
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Methods</CardTitle>
          <CardDescription>Cheque / Account Payee information shown on invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cheque Info</Label>
            <Input
              value={settings.payment_methods_text}
              onChange={(e) => setSettings(s => ({ ...s, payment_methods_text: e.target.value }))}
              placeholder='Cheque: Account Payee Cheque in favor of "Company Name"'
            />
          </div>

          {/* Bank Accounts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bank Accounts</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBank}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Bank
              </Button>
            </div>
            {settings.bank_accounts.map((bank, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Bank Name"
                  value={bank.bank_name}
                  onChange={(e) => updateBank(i, "bank_name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Account Number"
                  value={bank.account_no}
                  onChange={(e) => updateBank(i, "account_no", e.target.value)}
                  className="flex-1"
                />
                {settings.bank_accounts.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeBank(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mobile Payment</CardTitle>
          <CardDescription>bKash, Nagad, Rocket merchant/biller details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>bKash Merchant Account Number</Label>
              <Input
                value={settings.bkash_merchant}
                onChange={(e) => setSettings(s => ({ ...s, bkash_merchant: e.target.value }))}
                placeholder="e.g. 01681704141"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nagad Merchant Number</Label>
              <Input
                value={settings.nagad_merchant}
                onChange={(e) => setSettings(s => ({ ...s, nagad_merchant: e.target.value }))}
                placeholder="e.g. 01XXXXXXXXX"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Rocket Biller ID</Label>
            <Input
              value={settings.rocket_biller_id}
              onChange={(e) => setSettings(s => ({ ...s, rocket_biller_id: e.target.value }))}
              placeholder="e.g. 2112"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Card Payment Info</CardTitle>
          <CardDescription>VISA/Master/Amex card payment instructions</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.visa_card_info}
            onChange={(e) => setSettings(s => ({ ...s, visa_card_info: e.target.value }))}
            placeholder="VISA/Master/Amex or Other card: please contact 09666770444 to active your online account to pay by any Card"
            rows={2}
          />
        </CardContent>
      </Card>

      {/* Technical Support */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">24/7 Technical Support</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={settings.technical_support_phone}
            onChange={(e) => setSettings(s => ({ ...s, technical_support_phone: e.target.value }))}
            placeholder="e.g. 09666770444"
          />
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Payment Info Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground space-y-1">
            {settings.vat_registration_number && (
              <p>VAT Registration Number: {settings.vat_registration_number}</p>
            )}
            <p className="font-medium mt-2">Available Payment Method:</p>
            {settings.payment_methods_text && <p>{settings.payment_methods_text}</p>}
            {settings.bank_accounts.filter(b => b.bank_name).map((b, i) => (
              <p key={i}>{b.bank_name}: {b.account_no}</p>
            ))}
            {settings.bkash_merchant && <p>bKash Merchant Account Number: {settings.bkash_merchant}</p>}
            {settings.nagad_merchant && <p>Nagad Merchant Number: {settings.nagad_merchant}</p>}
            {settings.rocket_biller_id && <p>Rocket Biller ID: {settings.rocket_biller_id}</p>}
            {settings.visa_card_info && <p>{settings.visa_card_info}</p>}
            {settings.technical_support_phone && (
              <p className="mt-2">24/7 Technical Support: {settings.technical_support_phone}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Invoice Settings
        </Button>
      </div>
    </div>
  );
}

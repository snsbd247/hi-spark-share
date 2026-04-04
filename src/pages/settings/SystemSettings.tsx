import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MessageSquare, Receipt, Wallet, BookOpen, Globe } from "lucide-react";
import GeneralSettingsTab from "@/components/settings/GeneralSettingsTab";
import InvoiceSettingsTab from "@/components/settings/InvoiceSettingsTab";
import SmsTemplatesTab from "@/components/settings/SmsTemplatesTab";
import PaymentSettingsTab from "@/components/settings/PaymentSettingsTab";
import LedgerSettingsTab from "@/components/settings/LedgerSettingsTab";
import LanguageSettingsTab from "@/components/settings/LanguageSettingsTab";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-1">{t.settings.subtitle}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Settings className="h-4 w-4" /> {t.settings.general}
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Wallet className="h-4 w-4" /> {t.settings.payment}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" /> {t.settings.ledger}
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Globe className="h-4 w-4" /> {t.settings.language}
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Receipt className="h-4 w-4" /> {t.settings.invoice}
          </TabsTrigger>
          <TabsTrigger value="sms-templates" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4" /> {t.settings.smsTemplates}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralSettingsTab /></TabsContent>
        <TabsContent value="payment"><PaymentSettingsTab /></TabsContent>
        <TabsContent value="ledger"><LedgerSettingsTab /></TabsContent>
        <TabsContent value="language"><LanguageSettingsTab /></TabsContent>
        
        <TabsContent value="invoice"><InvoiceSettingsTab /></TabsContent>
        <TabsContent value="sms-templates"><SmsTemplatesTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

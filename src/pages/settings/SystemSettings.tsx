import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, FileText, Mail, MessageSquare, Server, Receipt } from "lucide-react";
import GeneralSettingsTab from "@/components/settings/GeneralSettingsTab";
import FooterSettingsTab from "@/components/settings/FooterSettingsTab";
import InvoiceSettingsTab from "@/components/settings/InvoiceSettingsTab";
import SmsTemplatesTab from "@/components/settings/SmsTemplatesTab";
import EmailTemplatesTab from "@/components/settings/EmailTemplatesTab";
import SmtpSettingsTab from "@/components/settings/SmtpSettingsTab";

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure global system settings and branding</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Settings className="h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger value="footer" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" /> Footer
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Receipt className="h-4 w-4" /> Invoice
          </TabsTrigger>
          <TabsTrigger value="sms-templates" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4" /> SMS Templates
          </TabsTrigger>
          <TabsTrigger value="email-templates" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Mail className="h-4 w-4" /> Email Templates
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Server className="h-4 w-4" /> SMTP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralSettingsTab /></TabsContent>
        <TabsContent value="footer"><FooterSettingsTab /></TabsContent>
        <TabsContent value="invoice"><InvoiceSettingsTab /></TabsContent>
        <TabsContent value="sms-templates"><SmsTemplatesTab /></TabsContent>
        <TabsContent value="email-templates"><EmailTemplatesTab /></TabsContent>
        <TabsContent value="smtp"><SmtpSettingsTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

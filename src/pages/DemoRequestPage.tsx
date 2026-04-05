import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DemoRequestForm from "@/components/demo/DemoRequestForm";

export default function DemoRequestPage() {
  const navigate = useNavigate();

  const { data: sections = [] } = useQuery({
    queryKey: ["landing-page-sections"],
    queryFn: async () => {
      const { data, error } = await (db as any).from("landing_sections").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: branding } = useQuery({
    queryKey: ["landing-branding"],
    queryFn: async () => {
      const res = await db.from("general_settings").select("*").limit(1).maybeSingle();
      return (res?.data || {}) as any;
    },
    staleTime: 60_000,
  });

  const demoMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(210,80%,20%)] via-[hsl(210,70%,25%)] to-[hsl(200,60%,30%)]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.site_name} className="h-8 w-auto" />
          ) : (
            <span className="text-lg font-bold text-white">{branding?.site_name || "Smart ISP"}</span>
          )}
        </div>
        <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-12 sm:py-20">
        <Card className="w-full max-w-lg shadow-2xl border-primary/10">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{demoMeta.demo_form_title || "Request a Free Demo"}</h1>
              <p className="text-sm text-muted-foreground">{demoMeta.demo_form_subtitle || "ডেমো রিকুয়েস্ট করুন, আমরা আপনার জন্য ডেমো সেটআপ করে দিব।"}</p>
            </div>
            <DemoRequestForm meta={demoMeta} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

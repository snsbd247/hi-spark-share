import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { superAdminApi } from "@/lib/superAdminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Zap, Shield, BarChart3, MessageSquare, Router, CreditCard,
  Check, ChevronDown, ChevronUp, ArrowRight, Loader2, Globe,
  Users, Clock, Star, Play, Wifi, Server, Receipt, Package,
  Phone, Mail, MapPin, Briefcase, Truck, Ticket, Activity,
  Building2, Network, Tag, UserCircle, DatabaseBackup, Cable, Calculator,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Zap, Shield, BarChart3, MessageSquare, Router, CreditCard,
  Globe, Users, Clock, Star, Wifi, Server, Receipt, Package, Phone, Mail, MapPin,
  Briefcase, Truck, Ticket, Activity, Building2, Network, Tag, UserCircle, DatabaseBackup, Cable, Calculator,
};
function getIcon(name: string | null) {
  if (!name) return Zap;
  return ICON_MAP[name] || Zap;
}

// ─── Branding Hook ───────────────────────────────────────────
function useBranding() {
  return useQuery({
    queryKey: ["landing-branding"],
    queryFn: async () => {
      const [settingsRes, footerRes] = await Promise.all([
        db.from("general_settings").select("*").limit(1).maybeSingle(),
        (db as any).from("system_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["branding_footer_text", "branding_copyright_text"]),
      ]);
      const s = (settingsRes?.data || {}) as any;
      const footerMap: Record<string, string> = {};
      ((footerRes?.data || footerRes || []) as any[]).forEach?.((r: any) => {
        footerMap[r.setting_key] = r.setting_value || "";
      });
      return {
        site_name: s.site_name || "Smart ISP",
        logo_url: s.logo_url || null,
        email: s.email || "",
        mobile: s.mobile || "",
        address: s.address || "",
        support_email: s.support_email || "",
        support_phone: s.support_phone || "",
        copyright_text: footerMap.branding_copyright_text || "",
        footer_text: footerMap.branding_footer_text || "",
      };
    },
    staleTime: 60_000,
  });
}

// ─── Sections Hook ───────────────────────────────────────────
function useLandingSections() {
  return useQuery({
    queryKey: ["landing-page-sections"],
    queryFn: async () => {
      const { data, error } = await (db as any).from("landing_sections").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}

// ─── Top Bar ─────────────────────────────────────────────────
function TopBar({ branding }: { branding: any }) {
  return (
    <div className="bg-[hsl(210,80%,15%)] text-white/80 text-xs py-2">
      <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          {branding.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {branding.email}</span>}
          {branding.support_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {branding.support_phone}</span>}
        </div>
        <div className="flex items-center gap-3">
          {branding.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {branding.mobile}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────
function Navbar({ branding, onCta, sections }: { branding: any; onCta: () => void; sections: any[] }) {
  const navMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const navLinks = (navMeta.nav_links as { label: string; href: string }[] | undefined) || [
    { label: "FEATURES", href: "#features" },
    { label: "PRICING", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "CONTACT", href: "#signup" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-card/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.site_name} className="h-8 w-auto" />
          ) : (
            <span className="text-lg font-bold text-foreground">{branding.site_name}</span>
          )}
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/login">ISP Login</a>
          </Button>
          <Button onClick={onCta} size="sm">{navMeta.cta_nav || "Demo Request"}</Button>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────
function HeroSection({ sections, onCta }: { sections: any[]; onCta: () => void }) {
  const hero = sections.find((s: any) => s.section_type === "hero");
  const stats = sections.filter((s: any) => s.section_type === "stat");
  const meta = hero?.metadata || {};
  const badges = (meta.hero_badges as string[]) || [];

  if (!hero) return null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(210,80%,20%)] via-[hsl(210,70%,25%)] to-[hsl(200,60%,30%)] pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center">
        {meta.badge && (
          <Badge className="mb-6 px-4 py-1.5 text-sm bg-primary/20 text-primary-foreground border-primary/30">
            {meta.badge}
          </Badge>
        )}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
          {hero.title}
        </h1>
        {hero.description && (
          <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            {hero.description}
          </p>
        )}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90" onClick={onCta}>
            {meta.cta_primary || "Start Free Trial"} <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          {meta.cta_secondary && (
            <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-xl bg-white/10 border-white/40 text-white hover:bg-white/20 hover:border-white/60 cursor-pointer shadow-md">
              <Play className="h-5 w-5 mr-2" /> {meta.cta_secondary}
            </Button>
          )}
        </div>
        {badges.length > 0 && (
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-white/60 flex-wrap">
            {badges.map((b: string, i: number) => (
              <span key={i} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> {b}</span>
            ))}
          </div>
        )}
        {stats.length > 0 && (
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map((s: any, i: number) => {
              const Icon = getIcon(s.icon);
              return (
                <div key={i} className="p-4 rounded-xl bg-white/5 backdrop-blur border border-white/10">
                  <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{s.title}</p>
                  <p className="text-xs text-white/60">{s.subtitle}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────
function FeaturesSection({ sections }: { sections: any[] }) {
  const features = sections.filter((s: any) => s.section_type === "feature");
  if (features.length === 0) return null;

  // Get section heading from first feature's metadata or use defaults from CMS
  const sectionMeta = features[0]?.metadata || {};
  const heading = sectionMeta.section_title || "Features";
  const subtitle = sectionMeta.section_subtitle || "";

  return (
    <section id="features" className="py-20 sm:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{heading}</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
          {subtitle && <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f: any, i: number) => {
            const Icon = getIcon(f.icon);
            return (
              <Card key={i} className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300 bg-card text-center">
                <CardContent className="p-6 space-y-3">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  {f.description && <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────
function PricingSection({ sections, onCta }: { sections: any[]; onCta: () => void }) {
  const { data: plans = [] } = useQuery({ queryKey: ["landing-plans"], queryFn: superAdminApi.getPlans });
  const pricingMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const heading = pricingMeta.pricing_title || "Package & Pricing";
  const subtitle = pricingMeta.pricing_subtitle || "";

  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{heading}</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
          {subtitle && <p className="mt-4 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.slice(0, 4).map((plan: any) => (
            <Card key={plan.id} className="relative overflow-hidden hover:shadow-xl transition-all bg-card text-center">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-xl font-extrabold text-foreground uppercase tracking-wide">{plan.name}</h3>
                {plan.setup_fee > 0 && (
                  <p className="text-sm text-primary font-medium">
                    Initial Setup - {plan.setup_fee} Tk
                  </p>
                )}
                <p className="text-lg font-semibold text-foreground">
                  {plan.max_customers ? `0 - ${plan.max_customers} Users` : "Unlimited Users"}
                </p>
                <p className="text-sm text-muted-foreground">
                  ৳{plan.price_monthly} /month
                </p>
                <Button className="w-full" onClick={onCta}>Order Now</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ────────────────────────────────────────────
function TestimonialsSection({ sections }: { sections: any[] }) {
  const testimonials = sections.filter((s: any) => s.section_type === "testimonial");
  if (testimonials.length === 0) return null;
  const sectionMeta = testimonials[0]?.metadata || {};

  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{sectionMeta.section_title || "What Our Clients Say"}</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t: any, i: number) => (
            <Card key={i} className="bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-1">
                  {[...Array(t.metadata?.rating || 5)].map((_, si) => (
                    <Star key={si} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.description}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {t.metadata?.avatar || t.title?.[0] || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.subtitle}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────
function FaqSection({ sections }: { sections: any[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = sections.filter((s: any) => s.section_type === "faq");
  if (faqs.length === 0) return null;
  const sectionMeta = faqs[0]?.metadata || {};

  return (
    <section id="faq" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{sectionMeta.section_title || "Frequently Asked Questions"}</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
        </div>
        <div className="space-y-3">
          {faqs.map((faq: any, i: number) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 sm:p-5 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="font-medium text-foreground text-sm sm:text-base">{faq.title}</span>
                {open === i ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
              </button>
              {open === i && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-muted-foreground leading-relaxed">
                  {faq.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Demo Request ────────────────────────────────────────────
function DemoRequestSection({ sections }: { sections: any[] }) {
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  // Get CMS content for demo section
  const demoMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await (db as any).from("demo_requests").insert({
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || null,
        message: form.message || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success(demoMeta.demo_success_toast || "🎉 Demo request submitted! We'll contact you soon.");
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit"),
  });

  const valid = form.company_name && form.contact_name && form.email;

  if (submitted) {
    return (
      <section id="signup" className="py-20 sm:py-28 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
          <Card className="shadow-xl border-primary/10">
            <CardContent className="p-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{demoMeta.demo_success_title || "Request Submitted!"}</h2>
              <p className="text-muted-foreground">{demoMeta.demo_success_message || "আপনার ডেমো রিকুয়েস্ট সফলভাবে জমা হয়েছে। আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে।"}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="signup" className="py-20 sm:py-28 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <Card className="shadow-xl border-primary/10">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{demoMeta.demo_form_title || "Request a Free Demo"}</h2>
              <p className="text-sm text-muted-foreground">{demoMeta.demo_form_subtitle || "ডেমো রিকুয়েস্ট করুন, আমরা আপনার জন্য ডেমো সেটআপ করে দিব।"}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{demoMeta.label_company || "ISP / Company Name"} *</Label>
                <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder={demoMeta.placeholder_company || "e.g. SpeedNet BD"} />
              </div>
              <div className="space-y-2">
                <Label>{demoMeta.label_contact || "Contact Person"} *</Label>
                <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder={demoMeta.placeholder_contact || "Your Name"} />
              </div>
              <div className="space-y-2">
                <Label>{demoMeta.label_email || "Email"} *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={demoMeta.placeholder_email || "you@example.com"} />
              </div>
              <div className="space-y-2">
                <Label>{demoMeta.label_phone || "Phone"}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder={demoMeta.placeholder_phone || "01XXXXXXXXX"} />
              </div>
              <div className="space-y-2">
                <Label>{demoMeta.label_message || "Message (optional)"}</Label>
                <Input value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder={demoMeta.placeholder_message || "আপনার ISP সম্পর্কে কিছু বলুন..."} />
              </div>
            </div>
            <Button className="w-full py-6" disabled={!valid || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : <>{demoMeta.demo_submit_text || "Submit Demo Request"} <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────
function LandingFooter({ sections, branding }: { sections: any[]; branding: any }) {
  const footerSections = sections.filter((s: any) => s.section_type === "footer");
  const about = footerSections.find((s: any) => s.title === "About Company");
  const contact = footerSections.find((s: any) => s.title === "Contact Info");
  const payment = footerSections.find((s: any) => s.title === "Payment Methods");
  const quickLinks = footerSections.find((s: any) => s.title === "Quick Links");
  const aboutMeta = about?.metadata || {};
  const contactMeta = contact?.metadata || {};
  const paymentMeta = payment?.metadata || {};
  const linksMeta = quickLinks?.metadata || {};

  // Use branding as fallback
  const companyName = aboutMeta.company_name || branding.site_name;
  const contactEmail = contactMeta.email || branding.support_email || branding.email;
  const contactPhone = contactMeta.phone || branding.support_phone || branding.mobile;
  const contactAddress = contactMeta.address || branding.address;

  // Quick links from CMS or defaults
  const links = (linksMeta.links as { label: string; href: string }[]) ||
    [{ label: "Home", href: "#" }, { label: "Features", href: "#features" }, { label: "Package & Pricing", href: "#pricing" }, { label: "Demo Request", href: "#signup" }];

  // Copyright from branding
  const copyright = branding.copyright_text
    ? branding.copyright_text.replace("{year}", new Date().getFullYear().toString())
    : `© Copyright ${new Date().getFullYear()} | ${aboutMeta.developer || companyName} | All Rights Reserved`;

  return (
    <footer className="bg-[hsl(210,80%,15%)] text-white/80 pt-16 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* About */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">{about?.subtitle || "About Company"}</h3>
            <div className="flex items-center gap-2">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={companyName} className="h-8 w-auto" />
              ) : (
                <span className="font-bold text-white text-lg">{companyName}</span>
              )}
            </div>
            {about?.description && <p className="text-sm text-white/60 leading-relaxed">{about.description}</p>}
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">{quickLinks?.subtitle || "Quick Links"}</h3>
            <ul className="space-y-2 text-sm">
              {links.map((link: any, i: number) => (
                <li key={i}>
                  <a href={link.href} className="text-white/60 hover:text-primary transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment Methods */}
          {payment && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-lg">{payment.subtitle || "Payment Method"}</h3>
              <div className="text-sm text-white/60 space-y-3">
                {paymentMeta.bank_name && (
                  <div>
                    <p className="font-semibold text-primary">═══ Bank Payment ═══</p>
                    {paymentMeta.account_name && <p>Account Name: <strong className="text-white/80">{paymentMeta.account_name}</strong></p>}
                    {paymentMeta.account_no && <p>Account No: <strong className="text-white/80">{paymentMeta.account_no}</strong></p>}
                    <p>Bank Name: {paymentMeta.bank_name}</p>
                  </div>
                )}
                {paymentMeta.bkash && (
                  <div>
                    <p className="font-semibold text-primary">═══ bKash Payment ═══</p>
                    <p>{paymentMeta.bkash}</p>
                  </div>
                )}
                {paymentMeta.nagad && (
                  <div>
                    <p className="font-semibold text-primary">═══ Nagad Payment ═══</p>
                    <p>{paymentMeta.nagad}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">{contact?.subtitle || "Let's Connect"}</h3>
            <div className="text-sm text-white/60 space-y-2">
              {contactEmail && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {contactEmail}</p>}
              {contactPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {contactPhone}</p>}
              {contactAddress && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {contactAddress}</p>}
            </div>
          </div>
        </div>

        <Separator className="bg-white/10" />
        <div className="pt-6 text-center text-xs text-white/40">
          {copyright}
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function LandingPage() {
  const { data: sections = [] } = useLandingSections();
  const { data: branding = { site_name: "", logo_url: null, email: "", mobile: "", address: "", support_email: "", support_phone: "", copyright_text: "", footer_text: "" } } = useBranding();

  const scrollToSignup = () => {
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar branding={branding} />
      <Navbar branding={branding} onCta={scrollToSignup} sections={sections} />
      <HeroSection sections={sections} onCta={scrollToSignup} />
      <FeaturesSection sections={sections} />
      <PricingSection sections={sections} onCta={scrollToSignup} />
      <TestimonialsSection sections={sections} />
      <FaqSection sections={sections} />
      <DemoRequestSection sections={sections} />
      <LandingFooter sections={sections} branding={branding} />
    </div>
  );
}

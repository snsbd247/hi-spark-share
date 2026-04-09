import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DemoQuickModal from "@/components/demo/DemoQuickModal";
import { db } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Zap, Shield, BarChart3, MessageSquare, Router, CreditCard,
  Check, ChevronDown, ChevronUp, ArrowRight, Globe,
  Users, Clock, Star, Play, Wifi, Server, Receipt, Package,
  Phone, Mail, MapPin, Briefcase, Truck, Ticket, Activity,
  Building2, Network, Tag, UserCircle, DatabaseBackup, Cable, Calculator,
  Menu, X, Layers, Settings, CheckCircle2,
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

// ─── Navbar ──────────────────────────────────────────────────
function Navbar({ branding, onCta, sections }: { branding: any; onCta: () => void; sections: any[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const navLinks = (navMeta.nav_links as { label: string; href: string }[] | undefined) || [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.site_name} className="h-8 w-auto" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Wifi className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">{branding.site_name}</span>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <a href="/admin/login">Login</a>
          </Button>
          <Button onClick={onCta} size="sm" className="rounded-full px-5">
            {navMeta.cta_nav || "Get Started"} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-background pb-4 px-4 space-y-2">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm text-muted-foreground hover:text-foreground font-medium">
              {link.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href="/admin/login">Login</a>
            </Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={() => { setMobileOpen(false); onCta(); }}>
              Get Started
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────
function HeroSection({ sections, onCta }: { sections: any[]; onCta: () => void }) {
  const hero = sections.find((s: any) => s.section_type === "hero");
  const stats = sections.filter((s: any) => s.section_type === "stat");
  const meta = hero?.metadata || {};
  const badges = (meta.hero_badges as string[]) || [];

  return (
    <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-32 lg:pb-36">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-background to-accent/[0.03]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.06] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/[0.05] rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-4xl mx-auto">
          {meta.badge && (
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium rounded-full border-primary/20 bg-primary/10 text-primary">
              <Zap className="h-3.5 w-3.5 mr-1.5" /> {meta.badge}
            </Badge>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight leading-[1.1]">
            {hero?.title || ""}
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {hero?.description || ""}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-base px-8 h-12 rounded-full shadow-lg shadow-primary/20" onClick={onCta}>
              {meta.cta_primary || "Start Free Trial"} <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            {(meta.cta_secondary || true) && (
              <Button size="lg" variant="outline" className="text-base px-8 h-12 rounded-full">
                <Play className="h-4 w-4 mr-2" /> {meta.cta_secondary || "Watch Demo"}
              </Button>
            )}
          </div>

          {badges.length > 0 && (
            <div className="mt-10 flex items-center justify-center gap-6 sm:gap-8 text-sm text-muted-foreground flex-wrap">
              {badges.map((b: string, i: number) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" /> {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Trust Stats */}
        {stats.length > 0 && (
          <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {stats.map((s: any, i: number) => {
              const Icon = getIcon(s.icon);
              return (
                <div key={i} className="text-center p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover-lift">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.subtitle}</p>
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

  const sectionMeta = features[0]?.metadata || {};
  const heading = sectionMeta.section_title || "Everything You Need to Run Your ISP";
  const subtitle = sectionMeta.section_subtitle || "Powerful modules designed for modern ISP businesses";

  return (
    <section id="features" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-medium">
            <Layers className="h-3 w-3 mr-1" /> Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{heading}</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f: any, i: number) => {
            const Icon = getIcon(f.icon);
            return (
              <Card key={i} className="group border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-300 bg-card">
                <CardContent className="p-6 space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
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

// ─── How It Works ────────────────────────────────────────────
function HowItWorks({ sections }: { sections: any[] }) {
  const howSteps = sections.filter((s: any) => s.section_type === "how_it_works");
  const defaultSteps = [
    { icon: Settings, title: "Setup Your ISP", description: "Register and configure your ISP settings, packages, and payment methods in minutes." },
    { icon: Users, title: "Add Customers", description: "Import or add customers, assign packages, and set up their connections effortlessly." },
    { icon: BarChart3, title: "Manage & Grow", description: "Automate billing, monitor network, track revenue, and scale your business." },
  ];
  const sectionMeta = howSteps[0]?.metadata || {};
  const steps = howSteps.length > 0
    ? howSteps.map((s: any) => ({ icon: getIcon(s.icon), title: s.title, description: s.description }))
    : defaultSteps;

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1" /> How It Works
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{sectionMeta.section_title || "Get Started in 3 Simple Steps"}</h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">{sectionMeta.section_subtitle || "From setup to full operation in under 30 minutes"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step: any, i: number) => {
            const Icon = typeof step.icon === 'function' ? step.icon : getIcon(step.icon);
            return (
              <div key={i} className="relative text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[calc(100%-20%)] h-px border-t-2 border-dashed border-border" />
                )}
                <div className="relative z-10 mx-auto h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-8 w-8 text-primary" />
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────
function PricingSection({ sections, onCta }: { sections: any[]; onCta: () => void }) {
  const { data: plans = [] } = useQuery({
    queryKey: ["landing-plans"],
    queryFn: async () => {
      const { data, error } = await db.from("saas_plans").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
  const pricingMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const heading = pricingMeta.pricing_title || "Simple, Transparent Pricing";
  const subtitle = pricingMeta.pricing_subtitle || "Choose the plan that fits your business";

  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-medium">
            <CreditCard className="h-3 w-3 mr-1" /> Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{heading}</h2>
          <p className="mt-4 text-muted-foreground">{subtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.slice(0, 4).map((plan: any, idx: number) => {
            const isPopular = idx === 1;
            return (
              <Card key={plan.id} className={`relative overflow-hidden transition-all duration-300 bg-card ${isPopular ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" : "border-border/60 hover:border-primary/30 hover:shadow-md"}`}>
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                )}
                <CardContent className="p-6 space-y-5">
                  {isPopular && (
                    <Badge className="bg-primary/10 text-primary border-0 text-xs">Most Popular</Badge>
                  )}
                  <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">{plan.name}</h3>
                  <div>
                    <span className="text-3xl font-extrabold text-foreground">৳{plan.price_monthly}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.max_customers ? `Up to ${plan.max_customers} customers` : "Unlimited customers"}
                  </p>
                  {plan.setup_fee > 0 && (
                    <p className="text-xs text-muted-foreground">Setup fee: ৳{plan.setup_fee}</p>
                  )}
                  <Button className={`w-full rounded-full ${isPopular ? "" : "variant-outline"}`} variant={isPopular ? "default" : "outline"} onClick={onCta}>
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            );
          })}
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
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-medium">
            <Star className="h-3 w-3 mr-1" /> Testimonials
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{sectionMeta.section_title || "Trusted by ISP Owners"}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t: any, i: number) => (
            <Card key={i} className="border-border/60 hover:shadow-md transition-all bg-card">
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-0.5">
                  {[...Array(t.metadata?.rating || 5)].map((_, si) => (
                    <Star key={si} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.description}"</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {t.metadata?.avatar || t.title?.[0] || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.title}</p>
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
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-medium">FAQ</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{sectionMeta.section_title || "Frequently Asked Questions"}</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq: any, i: number) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card overflow-hidden transition-shadow hover:shadow-sm">
              <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="font-medium text-foreground text-sm sm:text-base pr-4">{faq.title}</span>
                <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors ${open === i ? "bg-primary/10" : "bg-muted"}`}>
                  {open === i ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed animate-fade-in">
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

// ─── Contact Section ─────────────────────────────────────────
function ContactSection({ branding }: { branding: any }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    try {
      await db.functions.invoke("send-email", {
        body: {
          to: branding.support_email || branding.email || "admin@example.com",
          subject: `Contact Form: ${form.name}`,
          html: `<h3>New Contact Message</h3><p><b>Name:</b> ${form.name}</p><p><b>Phone:</b> ${form.phone || "N/A"}</p><p><b>Email:</b> ${form.email}</p><p><b>Message:</b><br/>${form.message}</p>`,
        },
      });
      setSent(true);
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-medium">
            <Mail className="h-3 w-3 mr-1" /> Contact
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Contact Us</h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Have questions? We'd love to hear from you.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left - Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Get in Touch</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Reach out to us for any inquiries about our platform, pricing, or partnership opportunities. Our team is ready to help you.
              </p>
            </div>
            <div className="space-y-5">
              {branding.address && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Address</p>
                    <p className="text-sm text-muted-foreground">{branding.address}</p>
                  </div>
                </div>
              )}
              {(branding.support_phone || branding.mobile) && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Phone</p>
                    <p className="text-sm text-muted-foreground">{branding.support_phone || branding.mobile}</p>
                  </div>
                </div>
              )}
              {(branding.support_email || branding.email) && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Email</p>
                    <p className="text-sm text-muted-foreground">{branding.support_email || branding.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right - Form */}
          <Card className="border-border/60 shadow-md bg-card">
            <CardContent className="p-6 sm:p-8">
              {sent ? (
                <div className="text-center py-10 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Check className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Message Sent!</h3>
                  <p className="text-sm text-muted-foreground">We'll get back to you shortly.</p>
                  <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={() => setSent(false)}>
                    Send Another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Name <span className="text-destructive">*</span></label>
                      <input
                        type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your name"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Phone</label>
                      <input
                        type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Phone number"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email <span className="text-destructive">*</span></label>
                    <input
                      type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="your@email.com"
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Message <span className="text-destructive">*</span></label>
                    <textarea
                      required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Write your message..."
                      className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-full h-11" disabled={sending}>
                    {sending ? "Sending..." : "Send Message"} {!sending && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────
function FinalCta({ onCta, sections, branding }: { onCta: () => void; sections: any[]; branding: any }) {
  const cta = sections.find((s: any) => s.section_type === "cta");
  const meta = cta?.metadata || {};
  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/[0.08] to-accent/[0.05] border border-primary/10 p-10 sm:p-16 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.06] rounded-full blur-[80px]" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {cta?.title || "Ready to Transform Your ISP?"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-lg">
              {cta?.description || `Join hundreds of ISP owners who trust ${branding.site_name || "us"} to manage their business. Start your free trial today.`}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-base px-8 h-12 rounded-full shadow-lg shadow-primary/20" onClick={onCta}>
                {meta.cta_primary || "Get Started Free"} <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 rounded-full" asChild>
                <a href="/demo-request">{meta.cta_secondary || "Request Full Demo"}</a>
              </Button>
            </div>
          </div>
        </div>
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

  const companyName = aboutMeta.company_name || branding.site_name;
  const contactEmail = contactMeta.email || branding.support_email || branding.email;
  const contactPhone = contactMeta.phone || branding.support_phone || branding.mobile;
  const contactAddress = contactMeta.address || branding.address;

  const links = (linksMeta.links as { label: string; href: string }[]) ||
    [{ label: "Home", href: "#" }, { label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Demo", href: "/demo-request" }];

  const copyright = branding.copyright_text
    ? branding.copyright_text.replace("{year}", new Date().getFullYear().toString())
    : `© ${new Date().getFullYear()} ${aboutMeta.developer || companyName}. All rights reserved.`;

  return (
    <footer className="bg-foreground text-background/70 pt-16 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* About */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={companyName} className="h-8 w-auto brightness-200" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <Wifi className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-background text-lg">{companyName}</span>
                </div>
              )}
            </div>
            {about?.description && <p className="text-sm leading-relaxed">{about.description}</p>}
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-background font-semibold">{quickLinks?.subtitle || "Quick Links"}</h3>
            <ul className="space-y-2.5 text-sm">
              {links.map((link: any, i: number) => (
                <li key={i}>
                  <a href={link.href} className="hover:text-primary transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment Methods */}
          {payment && (
            <div className="space-y-4">
              <h3 className="text-background font-semibold">{payment.subtitle || "Payment Methods"}</h3>
              <div className="text-sm space-y-3">
                {paymentMeta.bank_name && (
                  <div className="space-y-1">
                    <p className="text-primary font-medium text-xs uppercase tracking-wide">Bank Transfer</p>
                    {paymentMeta.account_name && <p>A/C: <span className="text-background/80">{paymentMeta.account_name}</span></p>}
                    {paymentMeta.account_no && <p>No: <span className="text-background/80">{paymentMeta.account_no}</span></p>}
                    <p>{paymentMeta.bank_name}</p>
                  </div>
                )}
                {paymentMeta.bkash && (
                  <div>
                    <p className="text-primary font-medium text-xs uppercase tracking-wide">bKash</p>
                    <p>{paymentMeta.bkash}</p>
                  </div>
                )}
                {paymentMeta.nagad && (
                  <div>
                    <p className="text-primary font-medium text-xs uppercase tracking-wide">Nagad</p>
                    <p>{paymentMeta.nagad}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-background font-semibold">{contact?.subtitle || "Contact"}</h3>
            <div className="text-sm space-y-2.5">
              {contactEmail && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary shrink-0" /> {contactEmail}</p>}
              {contactPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary shrink-0" /> {contactPhone}</p>}
              {contactAddress && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary shrink-0" /> {contactAddress}</p>}
            </div>
          </div>
        </div>

        <Separator className="bg-background/10" />
        <div className="pt-6 text-center text-xs text-background/40">
          {copyright}
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: sections = [] } = useLandingSections();
  const { data: branding = { site_name: "", logo_url: null, email: "", mobile: "", address: "", support_email: "", support_phone: "", copyright_text: "", footer_text: "" } } = useBranding();

  const demoMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const openModal = () => setModalOpen(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar branding={branding} onCta={openModal} sections={sections} />
      <HeroSection sections={sections} onCta={openModal} />
      <FeaturesSection sections={sections} />
      <HowItWorks sections={sections} />
      <PricingSection sections={sections} onCta={openModal} />
      <TestimonialsSection sections={sections} />
      <FaqSection sections={sections} />
      <ContactSection branding={branding} />
      <FinalCta onCta={openModal} sections={sections} branding={branding} />
      <LandingFooter sections={sections} branding={branding} />
      <DemoQuickModal open={modalOpen} onOpenChange={setModalOpen} meta={demoMeta} />
    </div>
  );
}

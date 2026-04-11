import { useState } from "react";
import { toast } from "sonner";
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
  Menu, X, Layers, Settings, CheckCircle2, Sparkles,
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

// ─── Scroll Helper ───────────────────────────────────────────
function scrollToSection(href: string) {
  const hash = href.includes("#") ? href.split("#").pop() || "" : "";
  if (!hash) return false;
  // Try direct ID match first, then data-section fallback
  const el = document.getElementById(hash) || document.querySelector(`[data-section="${hash}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
    window.history.replaceState(null, "", "#" + hash);
    return true;
  }
  return false;
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
    <nav className="sticky top-0 z-50 bg-background/70 backdrop-blur-2xl border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2.5">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.site_name} className="h-7 w-auto" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground">{branding.site_name}</span>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} onClick={(e) => {
              e.preventDefault();
              scrollToSection(link.href);
            }} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground h-8 text-[13px]">
            <a href="/admin/login">Login</a>
          </Button>
          <Button onClick={onCta} size="sm" className="rounded-full px-4 h-8 text-[13px]">
            {navMeta.cta_nav || "Get Started"} <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl pb-4 px-4 space-y-1">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} onClick={(e) => {
              e.preventDefault();
              setMobileOpen(false);
              scrollToSection(link.href);
            }}
              className="block py-2 text-sm text-muted-foreground hover:text-foreground font-medium">
              {link.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" asChild className="flex-1 h-9">
              <a href="/admin/login">Login</a>
            </Button>
            <Button size="sm" className="flex-1 rounded-full h-9" onClick={() => { setMobileOpen(false); onCta(); }}>
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
    <section className="relative overflow-hidden py-8 sm:py-12 lg:py-16">
      {/* Subtle mesh gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-accent/[0.03] rounded-full blur-[80px]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto">
          {meta.badge && (
            <Badge variant="secondary" className="mb-5 px-3 py-1 text-xs font-medium rounded-full border-primary/20 bg-primary/8 text-primary inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> {meta.badge}
            </Badge>
          )}

          <h1 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-extrabold text-foreground tracking-tight leading-[1.15]">
            {hero?.title || ""}
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {hero?.description || ""}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="text-sm px-7 h-11 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/35 transition-shadow" onClick={onCta}>
              {meta.cta_primary || "Start Free Trial"} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            {(meta.cta_secondary || true) && (
              <Button size="lg" variant="outline" className="text-sm px-7 h-11 rounded-full border-border/60">
                <Play className="h-3.5 w-3.5 mr-2" /> {meta.cta_secondary || "Watch Demo"}
              </Button>
            )}
          </div>

          {badges.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
              {badges.map((b: string, i: number) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" /> {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Trust Stats */}
        {stats.length > 0 && (
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {stats.map((s: any, i: number) => {
              const Icon = getIcon(s.icon);
              return (
                <div key={i} className="text-center p-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.subtitle}</p>
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
    <section id="features" className="scroll-mt-16 py-8 sm:py-12 bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-[11px] font-medium">
            <Layers className="h-3 w-3 mr-1" /> Features
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{heading}</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">{subtitle}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {features.map((f: any, i: number) => {
            const Icon = getIcon(f.icon);
            return (
              <div key={i} className="group p-4 rounded-xl bg-card/60 backdrop-blur-sm border border-border/40 hover:border-primary/25 hover:bg-card transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-[13px] font-semibold text-foreground leading-snug">{f.title}</h3>
                {f.description && <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{f.description}</p>}
              </div>
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
    <section id="how-it-works" className="scroll-mt-16 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-[11px] font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1" /> How It Works
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{sectionMeta.section_title || "Get Started in 3 Simple Steps"}</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">{sectionMeta.section_subtitle || "From setup to full operation in under 30 minutes"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step: any, i: number) => {
            const Icon = typeof step.icon === 'function' ? step.icon : getIcon(step.icon);
            return (
              <div key={i} className="relative text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[calc(100%-20%)] h-px border-t-2 border-dashed border-border/60" />
                )}
                <div className="relative z-10 mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                  <Icon className="h-7 w-7 text-primary" />
                  <span className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-sm">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">{step.description}</p>
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
    <section id="pricing" className="scroll-mt-16 py-8 sm:py-12 bg-muted/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-[11px] font-medium">
            <CreditCard className="h-3 w-3 mr-1" /> Pricing
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{heading}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.slice(0, 4).map((plan: any, idx: number) => {
            const isPopular = idx === 1;
            return (
              <div key={plan.id} className={`relative rounded-2xl p-5 transition-all duration-200 ${
                isPopular 
                  ? "bg-card border-2 border-primary shadow-lg shadow-primary/10 scale-[1.02]" 
                  : "bg-card/60 backdrop-blur-sm border border-border/40 hover:border-primary/25 hover:bg-card"
              }`}>
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-t-2xl" />
                )}
                <div className="space-y-4">
                  {isPopular && (
                    <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Most Popular</Badge>
                  )}
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{plan.name}</h3>
                  <div>
                    <span className="text-2xl font-extrabold text-foreground">৳{plan.price_monthly}</span>
                    <span className="text-xs text-muted-foreground">/month</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.max_customers ? `Up to ${plan.max_customers} customers` : "Unlimited customers"}
                  </p>
                  {plan.setup_fee > 0 && (
                    <p className="text-[11px] text-muted-foreground">Setup: ৳{plan.setup_fee}</p>
                  )}
                  <Button className={`w-full rounded-full h-9 text-xs ${isPopular ? "shadow-sm shadow-primary/20" : ""}`} variant={isPopular ? "default" : "outline"} onClick={onCta}>
                    Get Started
                  </Button>
                </div>
              </div>
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
    <section className="py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-[11px] font-medium">
            <Star className="h-3 w-3 mr-1" /> Testimonials
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{sectionMeta.section_title || "Trusted by ISP Owners"}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t: any, i: number) => (
            <div key={i} className="p-5 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-colors space-y-3">
              <div className="flex gap-0.5">
                {[...Array(t.metadata?.rating || 5)].map((_, si) => (
                  <Star key={si} className="h-3.5 w-3.5 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic">"{t.description}"</p>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xs">
                  {t.metadata?.avatar || t.title?.[0] || "?"}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-xs">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">{t.subtitle}</p>
                </div>
              </div>
            </div>
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
    <section id="faq" className="scroll-mt-16 py-8 sm:py-12 bg-muted/20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-[11px] font-medium">FAQ</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{sectionMeta.section_title || "Frequently Asked Questions"}</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq: any, i: number) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden hover:border-primary/15 transition-colors">
              <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="font-medium text-foreground text-sm pr-4">{faq.title}</span>
                <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${open === i ? "bg-primary/10" : "bg-muted/60"}`}>
                  {open === i ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed animate-fade-in">
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
      // Save to database
      await db.from("contact_messages").insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        message: form.message,
      });
      // Also send email
      await db.functions.invoke("send-email", {
        body: {
          to: branding.support_email || branding.email || "admin@example.com",
          subject: `Contact Form: ${form.name}`,
          html: `<h3>New Contact Message</h3><p><b>Name:</b> ${form.name}</p><p><b>Phone:</b> ${form.phone || "N/A"}</p><p><b>Email:</b> ${form.email}</p><p><b>Message:</b><br/>${form.message}</p>`,
        },
      }).catch(() => {});
      setSent(true);
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const inputClass = "flex h-9 w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 transition-shadow";

  return (
    <section id="contact" data-section="signup" className="scroll-mt-16 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-[11px] font-medium">
            <Mail className="h-3 w-3 mr-1" /> Contact
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Contact Us</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">Have questions? We'd love to hear from you.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left - Info */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Get in Touch</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Reach out to us for any inquiries about our platform, pricing, or partnership opportunities.
              </p>
            </div>
            <div className="space-y-4">
              {branding.address && (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">Address</p>
                    <p className="text-xs text-muted-foreground">{branding.address}</p>
                  </div>
                </div>
              )}
              {(branding.support_phone || branding.mobile) && (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">Phone</p>
                    <p className="text-xs text-muted-foreground">{branding.support_phone || branding.mobile}</p>
                  </div>
                </div>
              )}
              {(branding.support_email || branding.email) && (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">Email</p>
                    <p className="text-xs text-muted-foreground">{branding.support_email || branding.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right - Form */}
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-6">
            {sent ? (
              <div className="text-center py-8 space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Message Sent!</h3>
                <p className="text-xs text-muted-foreground">We'll get back to you shortly.</p>
                <Button variant="outline" size="sm" className="mt-2 rounded-full h-8 text-xs" onClick={() => setSent(false)}>
                  Send Another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Name <span className="text-destructive">*</span></label>
                    <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" className={inputClass} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Email <span className="text-destructive">*</span></label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Message <span className="text-destructive">*</span></label>
                  <textarea required rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message..."
                    className="flex min-h-[80px] w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 resize-none transition-shadow"
                  />
                </div>
                <Button type="submit" className="w-full rounded-full h-9 text-xs" disabled={sending}>
                  {sending ? "Sending..." : "Send Message"} {!sending && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
                </Button>
              </form>
            )}
          </div>
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
    <section className="py-8 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="relative rounded-2xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-accent/[0.04] border border-primary/10 p-8 sm:p-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/[0.06] rounded-full blur-[60px]" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              {cta?.title || "Ready to Transform Your ISP?"}
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6 text-sm">
              {cta?.description || `Join hundreds of ISP owners who trust ${branding.site_name || "us"} to manage their business.`}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="text-sm px-7 h-10 rounded-full shadow-lg shadow-primary/20" onClick={onCta}>
                {meta.cta_primary || "Get Started Free"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-sm px-7 h-10 rounded-full" asChild>
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
    <footer className="bg-foreground text-background/60 pt-12 pb-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={companyName} className="h-7 w-auto brightness-200" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                    <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-background text-base">{companyName}</span>
                </div>
              )}
            </div>
            {about?.description && <p className="text-xs leading-relaxed">{about.description}</p>}
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h3 className="text-background font-semibold text-sm">{quickLinks?.subtitle || "Quick Links"}</h3>
            <ul className="space-y-2 text-xs">
              {links.map((link: any, i: number) => (
                <li key={i}>
                  <a href={link.href} className="hover:text-primary transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment Methods */}
          {payment && (
            <div className="space-y-3">
              <h3 className="text-background font-semibold text-sm">{payment.subtitle || "Payment Methods"}</h3>
              <div className="text-xs space-y-2">
                {paymentMeta.bank_name && (
                  <div className="space-y-0.5">
                    <p className="text-primary font-medium text-[10px] uppercase tracking-wide">Bank Transfer</p>
                    {paymentMeta.account_name && <p>A/C: <span className="text-background/70">{paymentMeta.account_name}</span></p>}
                    {paymentMeta.account_no && <p>No: <span className="text-background/70">{paymentMeta.account_no}</span></p>}
                    <p>{paymentMeta.bank_name}</p>
                  </div>
                )}
                {paymentMeta.bkash && (
                  <div>
                    <p className="text-primary font-medium text-[10px] uppercase tracking-wide">bKash</p>
                    <p>{paymentMeta.bkash}</p>
                  </div>
                )}
                {paymentMeta.nagad && (
                  <div>
                    <p className="text-primary font-medium text-[10px] uppercase tracking-wide">Nagad</p>
                    <p>{paymentMeta.nagad}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-background font-semibold text-sm">{contact?.subtitle || "Contact"}</h3>
            <div className="text-xs space-y-2">
              {contactEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary shrink-0" /> {contactEmail}</p>}
              {contactPhone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary shrink-0" /> {contactPhone}</p>}
              {contactAddress && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {contactAddress}</p>}
            </div>
          </div>
        </div>

        <Separator className="bg-background/10" />
        <div className="pt-4 text-center text-[11px] text-background/35">
          {copyright}
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: sections = [], isLoading: sectionsLoading, isFetching: sectionsFetching } = useLandingSections();
  const { data: branding = { site_name: "", logo_url: null, email: "", mobile: "", address: "", support_email: "", support_phone: "", copyright_text: "", footer_text: "" }, isLoading: brandingLoading, isFetching: brandingFetching } = useBranding();

  const demoMeta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const openModal = () => setModalOpen(true);

  if (sectionsLoading || brandingLoading || sectionsFetching || brandingFetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-7 w-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

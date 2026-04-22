import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import DemoQuickModal from "@/components/demo/DemoQuickModal";
import { db } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Shield, BarChart3, MessageSquare, Router, CreditCard,
  Check, ChevronDown, ChevronUp, ArrowRight, Globe,
  Users, Clock, Star, Play, Wifi, Server, Receipt, Package,
  Phone, Mail, MapPin, Briefcase, Truck, Ticket, Activity,
  Building2, Network, Tag, UserCircle, DatabaseBackup, Cable, Calculator,
  Menu, X, Layers, Settings, CheckCircle2, Sparkles, Headphones,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Zap, Shield, BarChart3, MessageSquare, Router, CreditCard,
  Globe, Users, Clock, Star, Wifi, Server, Receipt, Package, Phone, Mail, MapPin,
  Briefcase, Truck, Ticket, Activity, Building2, Network, Tag, UserCircle,
  DatabaseBackup, Cable, Calculator, Layers, Settings, CheckCircle2, Sparkles, Headphones,
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

function scrollToSection(href: string) {
  const hash = href.includes("#") ? href.split("#").pop() || "" : "";
  if (!hash) return false;
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
    { label: "Platform", href: "#platform" },
    { label: "Modules", href: "#modules" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2.5">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.site_name} className="h-7 w-auto" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-base font-bold tracking-tight">{branding.site_name}</span>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground h-8 text-[13px]">
            <a href="/admin/login">Login</a>
          </Button>
          <Button onClick={onCta} size="sm" className="rounded-full px-4 h-8 text-[13px] bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
            {navMeta.cta_nav || "Get Started"} <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl pb-4 px-4 space-y-1">
          {navLinks.map((link: any, i: number) => (
            <a key={i} href={link.href} onClick={(e) => { e.preventDefault(); setMobileOpen(false); scrollToSection(link.href); }}
              className="block py-2 text-sm text-muted-foreground hover:text-foreground font-medium">
              {link.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" asChild className="flex-1 h-9"><a href="/admin/login">Login</a></Button>
            <Button size="sm" className="flex-1 rounded-full h-9 bg-gradient-to-r from-primary to-accent" onClick={() => { setMobileOpen(false); onCta(); }}>Get Started</Button>
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
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24">
      {/* Premium glow background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none opacity-60"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.15), transparent 70%)", filter: "blur(80px)" }} />
      <div className="absolute top-40 right-10 w-[400px] h-[400px] rounded-full pointer-events-none opacity-40"
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.18), transparent 70%)", filter: "blur(100px)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "64px 64px", maskImage: "radial-gradient(ellipse at center, black 40%, transparent 70%)" }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-4xl mx-auto">
          {meta.badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md mb-6">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{meta.badge}</span>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-balance">
            {hero?.title || "ISP ব্যবসার জন্য সম্পূর্ণ সমাধান"}{" "}
            {meta.title_accent && (
              <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary">
                {meta.title_accent}
              </span>
            )}
          </h1>

          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
            {hero?.description || ""}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={onCta}
              className="text-sm px-7 h-11 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_40px_-5px_hsl(var(--primary)/0.8)] transition-shadow">
              {meta.cta_primary || "Start Free Trial"} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" asChild
              className="text-sm px-7 h-11 rounded-full border-white/15 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.06]">
              <a href="#modules"><Play className="h-3.5 w-3.5 mr-2" /> {meta.cta_secondary || "See All Modules"}</a>
            </Button>
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

        {/* Hero Mockup */}
        <div className="mt-14 sm:mt-20 relative max-w-5xl mx-auto">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-2xl opacity-40" />
          <div className="relative rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl p-2 shadow-2xl">
            <div className="rounded-xl overflow-hidden border border-white/5 bg-background/80">
              <div className="h-9 border-b border-white/5 flex items-center px-3 gap-2 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="size-2.5 rounded-full bg-destructive/70" />
                  <div className="size-2.5 rounded-full bg-warning/70" />
                  <div className="size-2.5 rounded-full bg-success/70" />
                </div>
                <div className="mx-auto px-20 py-1 rounded-md bg-background/50 border border-white/5 text-[10px] text-muted-foreground font-mono">app.smartispapp.com/dashboard</div>
              </div>
              <DashboardMockup />
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {stats.map((s: any, i: number) => {
              const Icon = getIcon(s.icon);
              return (
                <div key={i} className="text-center p-4 rounded-2xl bg-card/40 backdrop-blur-md border border-white/5 hover:border-primary/30 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mx-auto mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{s.title}</p>
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

// Premium dashboard mockup (CSS-only, no external image)
function DashboardMockup() {
  return (
    <div className="aspect-[16/9] bg-gradient-to-br from-background via-muted/20 to-background p-4 sm:p-6 grid grid-cols-12 gap-3 sm:gap-4">
      <div className="col-span-3 hidden sm:flex flex-col gap-2">
        <div className="h-7 rounded-md bg-primary/15 border border-primary/20" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-6 rounded-md bg-white/[0.03] border border-white/5" />
        ))}
      </div>
      <div className="col-span-12 sm:col-span-9 flex flex-col gap-3 sm:gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { c: "from-primary/30 to-primary/5", v: "৳ 4.2L", l: "Revenue" },
            { c: "from-accent/30 to-accent/5", v: "1,284", l: "Active" },
            { c: "from-success/30 to-success/5", v: "84.2 Gbps", l: "Bandwidth" },
          ].map((card, i) => (
            <div key={i} className={`h-16 sm:h-20 rounded-lg bg-gradient-to-br ${card.c} border border-white/10 p-2 sm:p-3 flex flex-col justify-between`}>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">{card.l}</div>
              <div className="text-sm sm:text-lg font-bold">{card.v}</div>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-lg bg-white/[0.02] border border-white/5 p-3 relative overflow-hidden">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Bandwidth · 7d</div>
          <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,60 C30,40 60,55 90,35 S150,15 180,30 S240,55 300,25 L300,80 L0,80 Z" fill="url(#g1)" />
            <path d="M0,60 C30,40 60,55 90,35 S150,15 180,30 S240,55 300,25" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Trust Bar ───────────────────────────────────────────────
function TrustBar({ sections }: { sections: any[] }) {
  const meta = sections.find((s: any) => s.section_type === "hero")?.metadata || {};
  const trustText = meta.trust_text || "Trusted by leading ISPs across Bangladesh";
  const logos = (meta.trust_logos as string[]) || ["NexaFiber", "LinkStream", "MetroNet", "SkyWave", "Velocity"];
  return (
    <section className="border-y border-white/5 bg-card/30 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">{trustText}</p>
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-sm font-bold text-muted-foreground/40">
          {logos.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      </div>
    </section>
  );
}

// ─── Modules / Features ──────────────────────────────────────
function ModulesSection({ sections }: { sections: any[] }) {
  const features = sections.filter((s: any) => s.section_type === "feature");
  if (features.length === 0) return null;
  const sectionMeta = features[0]?.metadata || {};
  const heading = sectionMeta.section_title || "21 Interconnected Modules";
  const subtitle = sectionMeta.section_subtitle || "Everything you need to run a profitable ISP, in one cohesive platform";

  return (
    <section id="modules" className="scroll-mt-16 py-16 sm:py-24 relative">
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] rounded-full pointer-events-none opacity-30"
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.15), transparent 70%)", filter: "blur(100px)" }} />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mb-12">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">
            <Layers className="h-3 w-3 mr-1.5" /> Platform Modules
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            {heading}
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl text-pretty">{subtitle}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {features.map((f: any, i: number) => {
            const Icon = getIcon(f.icon);
            const accent = i % 5 === 0;
            return (
              <div key={i} className="group relative p-5 rounded-xl bg-card/40 backdrop-blur-md border border-white/5 hover:border-primary/30 hover:bg-card/60 transition-all overflow-hidden">
                {accent && <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors" />}
                <div className="relative">
                  <div className="size-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold leading-snug">{f.title}</h3>
                  {f.description && <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{f.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Mockup Gallery ──────────────────────────────────────────
function MockupGallery({ sections }: { sections: any[] }) {
  const items = sections.filter((s: any) => s.section_type === "mockup_gallery");
  if (items.length === 0) {
    // Fallback default gallery
    const fallback = [
      { title: "Customer 360°", subtitle: "PPPoE, billing & history in one view", icon: "UserCircle" },
      { title: "MikroTik Live Sync", subtitle: "Real-time queue & PPP status", icon: "Router" },
      { title: "Fiber Topology", subtitle: "OLT → Splitter → ONU mapping", icon: "Cable" },
    ];
    return <MockupGalleryRender items={fallback} sectionMeta={{}} />;
  }
  const sectionMeta = items[0]?.metadata || {};
  return <MockupGalleryRender items={items} sectionMeta={sectionMeta} />;
}

function MockupGalleryRender({ items, sectionMeta }: { items: any[]; sectionMeta: any }) {
  return (
    <section id="platform" className="scroll-mt-16 py-16 sm:py-24 bg-card/20 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">
            <Sparkles className="h-3 w-3 mr-1.5" /> Inside the Platform
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{sectionMeta.section_title || "Designed for operators, loved by teams"}</h2>
          <p className="mt-3 text-muted-foreground text-pretty">{sectionMeta.section_subtitle || "Every module built native, integrated, and obsessively polished."}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {items.map((item: any, i: number) => {
            const Icon = getIcon(item.icon);
            return (
              <div key={i} className="group relative rounded-2xl border border-white/10 bg-card/50 backdrop-blur-md overflow-hidden hover:border-primary/30 transition-colors">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <BrowserFrame variant={i % 3} />
                </div>
                <div className="p-5 border-t border-white/5">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle || item.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BrowserFrame({ variant = 0 }: { variant?: number }) {
  const palettes = [
    { primary: "hsl(var(--primary))", accent: "hsl(var(--accent))" },
    { primary: "hsl(var(--accent))", accent: "hsl(var(--success))" },
    { primary: "hsl(var(--success))", accent: "hsl(var(--primary))" },
  ];
  const p = palettes[variant];
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="h-full rounded-lg border border-white/10 bg-background/60 backdrop-blur p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <div className="size-2 rounded-full bg-white/20" />
            <div className="size-2 rounded-full bg-white/20" />
          </div>
          <div className="text-[8px] text-muted-foreground font-mono">/{["dashboard", "mikrotik", "fiber"][variant]}</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 rounded" style={{ background: `linear-gradient(135deg, ${p.primary}30, transparent)`, border: `1px solid ${p.primary}20` }} />
          ))}
        </div>
        <div className="flex-1 rounded relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.primary}10, ${p.accent}10)`, border: "1px solid hsl(var(--border) / 0.3)" }}>
          <svg viewBox="0 0 200 80" className="w-full h-full">
            <path d="M0,60 Q50,20 100,40 T200,30 L200,80 L0,80" fill={p.primary} fillOpacity="0.3" />
            <path d="M0,60 Q50,20 100,40 T200,30" stroke={p.primary} strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 rounded bg-white/5" />
          ))}
        </div>
      </div>
    </div>
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
    <section id="how-it-works" className="scroll-mt-16 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">
            <CheckCircle2 className="h-3 w-3 mr-1.5" /> Workflow
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{sectionMeta.section_title || "Get Started in 3 Steps"}</h2>
          <p className="mt-3 text-muted-foreground">{sectionMeta.section_subtitle || "From setup to full operation in under 30 minutes"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step: any, i: number) => {
            const Icon = typeof step.icon === "function" ? step.icon : getIcon(step.icon);
            return (
              <div key={i} className="relative text-center group p-6 rounded-2xl bg-card/40 backdrop-blur-md border border-white/5 hover:border-primary/20 transition-colors">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center mb-4 relative">
                  <Icon className="h-6 w-6 text-primary" />
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-lg">{i + 1}</span>
                </div>
                <h3 className="text-base font-semibold mb-1.5">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
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
  const [yearly, setYearly] = useState(false);
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
    <section id="pricing" className="scroll-mt-16 py-16 sm:py-24 bg-card/20 border-y border-white/5 relative">
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full pointer-events-none opacity-30"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.15), transparent 70%)", filter: "blur(100px)" }} />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">
            <CreditCard className="h-3 w-3 mr-1.5" /> Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{heading}</h2>
          <p className="mt-3 text-muted-foreground">{subtitle}</p>

          {/* Toggle */}
          <div className="mt-6 inline-flex items-center gap-1 p-1 rounded-full bg-card/60 backdrop-blur-md border border-white/10">
            <button onClick={() => setYearly(false)}
              className={`px-5 py-1.5 rounded-full text-xs font-medium transition-colors ${!yearly ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)}
              className={`px-5 py-1.5 rounded-full text-xs font-medium transition-colors ${yearly ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              Yearly <span className="ml-1 text-[10px] opacity-80">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.slice(0, 4).map((plan: any, idx: number) => {
            const isPopular = idx === 1;
            const monthly = Number(plan.price_monthly || 0);
            const yearlyPrice = Number(plan.price_yearly || monthly * 10) || monthly * 10;
            const display = yearly ? Math.round(yearlyPrice / 12) : monthly;
            return (
              <div key={plan.id} className={`relative rounded-2xl p-6 transition-all ${
                isPopular
                  ? "bg-card/80 border border-primary/40 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]"
                  : "bg-card/40 backdrop-blur-md border border-white/5 hover:border-primary/20"
              }`}>
                {isPopular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 text-[10px] px-3">Most Popular</Badge>
                )}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">৳{display}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.max_customers ? `Up to ${plan.max_customers} customers` : "Unlimited customers"}
                  </p>
                  {plan.setup_fee > 0 && (
                    <p className="text-[11px] text-muted-foreground">Setup: ৳{plan.setup_fee}</p>
                  )}
                  <Button onClick={onCta}
                    className={`w-full rounded-full h-9 text-xs ${isPopular ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" : ""}`}
                    variant={isPopular ? "default" : "outline"}>
                    Get Started <ArrowRight className="h-3.5 w-3.5 ml-1" />
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
    <section className="py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">
            <Star className="h-3 w-3 mr-1.5" /> Testimonials
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{sectionMeta.section_title || "Trusted by ISP Owners"}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t: any, i: number) => (
            <div key={i} className="p-6 rounded-2xl bg-card/40 backdrop-blur-md border border-white/5 hover:border-primary/20 transition-colors space-y-3">
              <div className="flex gap-0.5">
                {[...Array(t.metadata?.rating || 5)].map((_, si) => (
                  <Star key={si} className="h-3.5 w-3.5 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.description}"</p>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-foreground font-bold text-xs">
                  {t.metadata?.avatar || t.title?.[0] || "?"}
                </div>
                <div>
                  <p className="font-semibold text-xs">{t.title}</p>
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
    <section id="faq" className="scroll-mt-16 py-16 sm:py-20 bg-card/20 border-y border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">FAQ</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{sectionMeta.section_title || "Frequently Asked"}</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq: any, i: number) => (
            <div key={i} className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden hover:border-primary/15 transition-colors">
              <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="font-medium text-sm pr-4">{faq.title}</span>
                <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${open === i ? "bg-primary/15" : "bg-muted/40"}`}>
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

// ─── Contact ─────────────────────────────────────────────────
function ContactSection({ branding }: { branding: any }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    try {
      await db.from("contact_messages").insert({
        name: form.name, email: form.email, phone: form.phone || null, message: form.message,
      });
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

  const inputClass = "flex h-9 w-full rounded-lg border border-white/10 bg-background/40 backdrop-blur px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-shadow";

  return (
    <section id="contact" data-section="signup" className="scroll-mt-16 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 rounded-full border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest">
            <Mail className="h-3 w-3 mr-1.5" /> Contact
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Get in Touch</h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">Have questions? We'd love to hear from you.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            {branding.address && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-card/40 backdrop-blur-md border border-white/5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-xs">Address</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{branding.address}</p>
                </div>
              </div>
            )}
            {(branding.support_phone || branding.mobile) && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-card/40 backdrop-blur-md border border-white/5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-xs">Phone</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{branding.support_phone || branding.mobile}</p>
                </div>
              </div>
            )}
            {(branding.support_email || branding.email) && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-card/40 backdrop-blur-md border border-white/5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-xs">Email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{branding.support_email || branding.email}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/50 backdrop-blur-md p-6">
            {sent ? (
              <div className="text-center py-8 space-y-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-white/10 flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold">Message Sent!</h3>
                <p className="text-xs text-muted-foreground">We'll get back to you shortly.</p>
                <Button variant="outline" size="sm" className="mt-2 rounded-full h-8 text-xs" onClick={() => setSent(false)}>Send Another</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Name <span className="text-destructive">*</span></label>
                    <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" className={inputClass} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Email <span className="text-destructive">*</span></label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Message <span className="text-destructive">*</span></label>
                  <textarea required rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message..."
                    className="flex min-h-[80px] w-full rounded-lg border border-white/10 bg-background/40 backdrop-blur px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 resize-none" />
                </div>
                <Button type="submit" className="w-full rounded-full h-10 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground" disabled={sending}>
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
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-primary/[0.08] via-card/30 to-accent/[0.08] backdrop-blur-md p-10 sm:p-16 overflow-hidden text-center">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
              {cta?.title || "Ready to Transform Your ISP?"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-pretty">
              {cta?.description || `Join hundreds of ISP owners who trust ${branding.site_name || "us"} to manage their business.`}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={onCta}
                className="text-sm px-7 h-11 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]">
                {meta.cta_primary || "Get Started Free"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-sm px-7 h-11 rounded-full border-white/15 bg-white/[0.03] backdrop-blur-md" asChild>
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
    [{ label: "Home", href: "#" }, { label: "Modules", href: "#modules" }, { label: "Pricing", href: "#pricing" }, { label: "Demo", href: "/demo-request" }];

  const copyright = branding.copyright_text
    ? branding.copyright_text.replace("{year}", new Date().getFullYear().toString())
    : `© ${new Date().getFullYear()} ${aboutMeta.developer || companyName}. All rights reserved.`;

  return (
    <footer className="border-t border-white/5 bg-card/20 pt-14 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={companyName} className="h-7 w-auto" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-base">{companyName}</span>
                </div>
              )}
            </div>
            {about?.description && <p className="text-xs leading-relaxed text-muted-foreground">{about.description}</p>}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{quickLinks?.subtitle || "Quick Links"}</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {links.map((link: any, i: number) => (
                <li key={i}><a href={link.href} className="hover:text-primary transition-colors">{link.label}</a></li>
              ))}
            </ul>
          </div>

          {payment && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">{payment.subtitle || "Payment Methods"}</h3>
              <div className="text-xs space-y-2 text-muted-foreground">
                {paymentMeta.bank_name && (
                  <div className="space-y-0.5">
                    <p className="text-primary font-medium text-[10px] uppercase tracking-wide">Bank Transfer</p>
                    {paymentMeta.account_name && <p>A/C: <span className="text-foreground/80">{paymentMeta.account_name}</span></p>}
                    {paymentMeta.account_no && <p>No: <span className="text-foreground/80">{paymentMeta.account_no}</span></p>}
                    <p>{paymentMeta.bank_name}</p>
                  </div>
                )}
                {paymentMeta.bkash && (<div><p className="text-primary font-medium text-[10px] uppercase tracking-wide">bKash</p><p>{paymentMeta.bkash}</p></div>)}
                {paymentMeta.nagad && (<div><p className="text-primary font-medium text-[10px] uppercase tracking-wide">Nagad</p><p>{paymentMeta.nagad}</p></div>)}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{contact?.subtitle || "Contact"}</h3>
            <div className="text-xs space-y-2 text-muted-foreground">
              {contactAddress && <p className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />{contactAddress}</p>}
              {contactPhone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" />{contactPhone}</p>}
              {contactEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" />{contactEmail}</p>}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 text-center text-[11px] text-muted-foreground">
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
    <div className="min-h-screen bg-background text-foreground">
      <Navbar branding={branding} onCta={openModal} sections={sections} />
      <HeroSection sections={sections} onCta={openModal} />
      <TrustBar sections={sections} />
      <ModulesSection sections={sections} />
      <MockupGallery sections={sections} />
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

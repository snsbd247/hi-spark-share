import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Phone, Mail, MapPin,
} from "lucide-react";

// Icon map for dynamic rendering
const ICON_MAP: Record<string, any> = {
  Zap, Shield, BarChart3, MessageSquare, Router, CreditCard,
  Globe, Users, Clock, Star, Wifi, Server, Receipt, Package, Phone, Mail, MapPin,
};

function getIcon(name: string | null) {
  if (!name) return Zap;
  return ICON_MAP[name] || Zap;
}

// ─── Data Hook ───────────────────────────────────────────────
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

// ─── Hero ────────────────────────────────────────────────────
function HeroSection({ sections, onCta }: { sections: any[]; onCta: () => void }) {
  const hero = sections.find(s => s.section_type === "hero");
  const stats = sections.filter(s => s.section_type === "stat");
  const meta = hero?.metadata || {};

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
          {hero?.title || "Your ISP Business, Fully Automated"}
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
          {hero?.description || "Complete ISP management platform."}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90" onClick={onCta}>
            {meta.cta_primary || "Start Free Trial"} <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          {meta.cta_secondary && (
            <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-xl border-white/20 text-white hover:bg-white/10">
              <Play className="h-5 w-5 mr-2" /> {meta.cta_secondary}
            </Button>
          )}
        </div>
        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-white/60">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> 14-day free trial</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No credit card</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Setup in 5 min</span>
        </div>
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

// ─── Top Bar ─────────────────────────────────────────────────
function TopBar({ footerSections }: { footerSections: any[] }) {
  const contact = footerSections.find(s => s.title === "Contact Info");
  const meta = contact?.metadata || {};

  return (
    <div className="bg-[hsl(210,80%,15%)] text-white/80 text-xs py-2">
      <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          {meta.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {meta.email}</span>}
          {meta.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {meta.phone}</span>}
        </div>
        <div className="flex items-center gap-3">
          {meta.whatsapp && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {meta.whatsapp}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────
function Navbar({ onCta }: { onCta: () => void }) {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-card/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Smart ISP</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">FEATURES</a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">PRICING</a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          <a href="#signup" className="text-muted-foreground hover:text-foreground transition-colors">CONTACT</a>
        </div>
        <Button onClick={onCta} size="sm">Demo Request</Button>
      </div>
    </nav>
  );
}

// ─── Features ────────────────────────────────────────────────
function FeaturesSection({ sections }: { sections: any[] }) {
  const features = sections.filter(s => s.section_type === "feature");
  if (features.length === 0) return null;

  return (
    <section id="features" className="py-20 sm:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Features</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Smart ISP provides unique features that make your ISP fully digital and simplify daily operations.
          </p>
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
function PricingSection({ onCta }: { onCta: () => void }) {
  const { data: plans = [] } = useQuery({ queryKey: ["landing-plans"], queryFn: superAdminApi.getPlans });
  const displayPlans = plans.length > 0 ? plans : [
    { id: "1", name: "Starter", price_monthly: 500, max_customers: 100, max_users: 2 },
    { id: "2", name: "Business", price_monthly: 1500, max_customers: 500, max_users: 5 },
    { id: "3", name: "Enterprise", price_monthly: 3000, max_customers: 0, max_users: 0 },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Package & Pricing</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
          <p className="mt-4 text-muted-foreground">Affordable pricing with the best support & service.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayPlans.slice(0, 4).map((plan: any, i: number) => (
            <Card key={plan.id} className="relative overflow-hidden hover:shadow-xl transition-all bg-card text-center">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-xl font-extrabold text-foreground uppercase tracking-wide">{plan.name}</h3>
                <p className="text-sm text-primary font-medium">
                  Initial Setup - {plan.setup_fee || 2500} Tk
                </p>
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
  const testimonials = sections.filter(s => s.section_type === "testimonial");
  if (testimonials.length === 0) return null;

  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">What Our Clients Say</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t: any, i: number) => (
            <Card key={i} className="bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, si) => (
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
  const faqs = sections.filter(s => s.section_type === "faq");
  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Frequently Asked Questions</h2>
          <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full" />
        </div>
        <div className="space-y-3">
          {faqs.map((faq: any, i: number) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
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

// ─── Signup Section ──────────────────────────────────────────
function SignupSection() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subdomain: "" });

  const signup = useMutation({
    mutationFn: async () => {
      const tenant = await superAdminApi.createTenant({
        name: form.name, email: form.email, phone: form.phone, subdomain: form.subdomain,
      });
      const tenantId = Array.isArray(tenant) ? tenant[0]?.id : tenant?.id;
      try {
        const plans = await superAdminApi.getPlans();
        if (plans.length > 0) {
          await superAdminApi.assignSubscription({ tenant_id: tenantId, plan_id: plans[0].id, billing_cycle: "monthly" });
        }
      } catch {}
      try { await superAdminApi.updateTenant(tenantId, { status: "trial" }); } catch {}
      return tenantId;
    },
    onSuccess: (tenantId) => {
      toast.success("🎉 Account created!");
      setTimeout(() => navigate(`/super/tenants/${tenantId}`), 1500);
    },
    onError: (e: any) => toast.error(e.message || "Signup failed"),
  });

  const valid = form.name && form.email && form.subdomain && form.subdomain.length >= 3;

  return (
    <section id="signup" className="py-20 sm:py-28 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <Card className="shadow-xl border-primary/10">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Start Your Free Trial</h2>
              <p className="text-sm text-muted-foreground">14 days free. No credit card required.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ISP / Company Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. SpeedNet BD" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Subdomain *</Label>
                <div className="flex items-center gap-2">
                  <Input value={form.subdomain} onChange={e => setForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="your-isp" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.smartisp.com</span>
                </div>
              </div>
            </div>
            <Button className="w-full py-6" disabled={!valid || signup.isPending} onClick={() => signup.mutate()}>
              {signup.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</> : <>Create Account <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────
function LandingFooter({ sections }: { sections: any[] }) {
  const footerSections = sections.filter(s => s.section_type === "footer");
  const about = footerSections.find(s => s.title === "About Company");
  const contact = footerSections.find(s => s.title === "Contact Info");
  const payment = footerSections.find(s => s.title === "Payment Methods");
  const aboutMeta = about?.metadata || {};
  const contactMeta = contact?.metadata || {};
  const paymentMeta = payment?.metadata || {};

  return (
    <footer className="bg-[hsl(210,80%,15%)] text-white/80 pt-16 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* About */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">About Company</h3>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-white">{aboutMeta.company_name || "Smart ISP"}</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{about?.description || ""}</p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {["Home", "Features", "Package & Pricing", "Demo Request", "Contact"].map((link, i) => (
                <li key={i}>
                  <a href={`#${link.toLowerCase().replace(/\s+/g, "-")}`} className="text-white/60 hover:text-primary transition-colors">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment Methods */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">Payment Method</h3>
            <div className="text-sm text-white/60 space-y-3">
              {paymentMeta.bank_name && (
                <div>
                  <p className="font-semibold text-primary">═══ Bank Payment ═══</p>
                  <p>Account Name: <strong className="text-white/80">{paymentMeta.account_name}</strong></p>
                  <p>Account No: <strong className="text-white/80">{paymentMeta.account_no}</strong></p>
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

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">Let's Connect</h3>
            <div className="text-sm text-white/60 space-y-2">
              {contactMeta.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {contactMeta.email}</p>}
              {contactMeta.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {contactMeta.phone}</p>}
              {contactMeta.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {contactMeta.address}</p>}
            </div>
          </div>
        </div>

        <Separator className="bg-white/10" />
        <div className="pt-6 text-center text-xs text-white/40">
          © Copyright {new Date().getFullYear()} | {aboutMeta.developer || "Tech Expert Lab"} | All Rights Reserved
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function LandingPage() {
  const { data: sections = [] } = useLandingSections();

  const scrollToSignup = () => {
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  };

  const footerSections = sections.filter((s: any) => s.section_type === "footer");

  return (
    <div className="min-h-screen bg-background">
      <TopBar footerSections={footerSections} />
      <Navbar onCta={scrollToSignup} />
      <HeroSection sections={sections} onCta={scrollToSignup} />
      <FeaturesSection sections={sections} />
      <PricingSection onCta={scrollToSignup} />
      <TestimonialsSection sections={sections} />
      <FaqSection sections={sections} />
      <SignupSection />
      <LandingFooter sections={sections} />
    </div>
  );
}

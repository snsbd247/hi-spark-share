import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Globe, Plus, Trash2, Star, CheckCircle, AlertCircle, Loader2,
  Copy, Shield, ExternalLink, RefreshCw, Info, Server, ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import api from "@/lib/api";
import { IS_LOVABLE } from "@/lib/environment";
import { db } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DomainRecord {
  id: string;
  domain: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
}

// ── Domain format validation (client-side) ──────────────────
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;
const BLOCKED_DOMAINS = ["localhost", "smartispapp.com", "example.com", "test.com"];

function validateDomain(domain: string): { valid: boolean; error?: string } {
  const d = domain.trim().toLowerCase();
  if (!d) return { valid: false, error: "Domain is required" };
  if (d.length > 253) return { valid: false, error: "Domain too long (max 253 chars)" };
  if (!DOMAIN_REGEX.test(d)) return { valid: false, error: "Invalid domain format (e.g. billing.yourisp.com)" };
  if (BLOCKED_DOMAINS.some((b) => d === b || d.endsWith(`.${b}`)))
    return { valid: false, error: "This domain is reserved and cannot be used" };
  if (d.split(".").some((part) => part.length > 63))
    return { valid: false, error: "Each part of domain must be ≤63 characters" };
  return { valid: true };
}

// ── Copy to clipboard helper ────────────────────────────────
function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied!"));
}

const SERVER_IP_PLACEHOLDER = "YOUR_SERVER_IP";

const DomainManagement = () => {
  const { t } = useLanguage();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [subdomain, setSubdomain] = useState<string>("");
  const [newDomain, setNewDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [dnsDialogDomain, setDnsDialogDomain] = useState<DomainRecord | null>(null);

  // Client-side validation
  const domainValidation = useMemo(() => {
    if (!newDomain.trim()) return null;
    return validateDomain(newDomain);
  }, [newDomain]);

  const fetchDomains = async () => {
    try {
      if (IS_LOVABLE) {
        // Get current tenant's domains
        const currentUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
        const { data: profile } = await db.from("profiles").select("tenant_id").eq("id", currentUser.id).maybeSingle();
        const tenantId = profile?.tenant_id;

        if (tenantId) {
          const { data: domainData } = await db.from("domains").select("*").eq("tenant_id", tenantId).order("created_at");
          setDomains(domainData || []);

          const { data: tenant } = await db.from("tenants").select("subdomain").eq("id", tenantId).maybeSingle();
          setSubdomain(tenant?.subdomain || "");
        } else {
          // Fallback: get all domains for demo
          const { data: domainData } = await db.from("domains").select("*").order("created_at");
          setDomains(domainData || []);
        }
      } else {
        const res = await api.get("/domains");
        setDomains(res.data?.data || []);
        setSubdomain(res.data?.subdomain || "");
      }
    } catch {
      // Silent fail on load
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomains(); }, []);

  const addDomain = async () => {
    const v = validateDomain(newDomain);
    if (!v.valid) { toast.error(v.error); return; }
    setAdding(true);
    try {
      if (IS_LOVABLE) {
        const currentUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
        const { data: profile } = await db.from("profiles").select("tenant_id").eq("id", currentUser.id).maybeSingle();
        const tenantId = profile?.tenant_id;
        if (!tenantId) { toast.error("No tenant context found"); setAdding(false); return; }

        const { data: newDomainData, error } = await db.from("domains").insert({
          tenant_id: tenantId,
          domain: newDomain.trim().toLowerCase(),
          is_primary: false,
          is_verified: false,
        }).select().single();

        if (error) throw error;
        toast.success("Domain added! Configure DNS to complete setup.");
        setNewDomain("");
        fetchDomains();
        if (newDomainData) setDnsDialogDomain(newDomainData);
      } else {
        const res = await api.post("/domains", { domain: newDomain.trim().toLowerCase() });
        toast.success("Domain added! Configure DNS to complete setup.");
        setNewDomain("");
        fetchDomains();
        if (res.data?.data) setDnsDialogDomain(res.data.data);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.domain?.[0] || err?.message || "Failed to add domain";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const removeDomain = async (id: string) => {
    try {
      if (IS_LOVABLE) {
        await db.from("domains").delete().eq("id", id);
      } else {
        await api.delete(`/domains/${id}`);
      }
      toast.success("Domain removed");
      fetchDomains();
    } catch {
      toast.error("Failed to remove domain");
    }
  };

  const setPrimary = async (id: string) => {
    try {
      if (IS_LOVABLE) {
        // Unset all primary first
        const currentUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
        const { data: profile } = await db.from("profiles").select("tenant_id").eq("id", currentUser.id).maybeSingle();
        if (profile?.tenant_id) {
          // Set all domains of this tenant to not primary
          for (const d of domains) {
            if (d.is_primary) {
              await db.from("domains").update({ is_primary: false }).eq("id", d.id);
            }
          }
        }
        await db.from("domains").update({ is_primary: true }).eq("id", id);
      } else {
        await api.post(`/domains/${id}/primary`);
      }
      toast.success("Primary domain updated");
      fetchDomains();
    } catch {
      toast.error("Failed to set primary");
    }
  };

  const verifyDomain = async (id: string) => {
    setVerifying(id);
    try {
      if (IS_LOVABLE) {
        // In preview, simulate verification
        await db.from("domains").update({ is_verified: true }).eq("id", id);
        toast.success("✅ Domain verified (preview mode)");
      } else {
        const res = await api.post(`/domains/${id}/verify`);
        if (res.data?.verified) {
          toast.success("✅ Domain verified and active!");
        } else {
          toast.warning(res.data?.message || "DNS not yet pointing to server. Try again in a few minutes.");
        }
      }
      fetchDomains();
    } catch {
      toast.error("Verification failed");
    } finally {
      setVerifying(null);
    }
  };

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Main Domain Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Management
          </CardTitle>
          <CardDescription>
            Connect custom domains to your ISP billing portal. Each domain will load
            your branded panel with full data isolation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Subdomain */}
          {subdomain && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Default Subdomain (always active)</p>
                <p className="text-sm font-semibold text-foreground">
                  {subdomain}.smartispapp.com
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Active
              </Badge>
            </div>
          )}

          {/* Add Custom Domain */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Custom Domain</label>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="e.g. billing.yourisp.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                  className={domainValidation && !domainValidation.valid ? "border-destructive" : ""}
                />
                {domainValidation && !domainValidation.valid && (
                  <p className="text-xs text-destructive">{domainValidation.error}</p>
                )}
              </div>
              <Button
                onClick={addDomain}
                disabled={adding || !newDomain.trim() || (domainValidation !== null && !domainValidation.valid)}
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </div>

          <Separator />

          {/* Domain List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No custom domains configured yet.</p>
              <p className="text-xs text-muted-foreground">Add a domain above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Custom Domains ({domains.length})
              </h4>
              {domains.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{d.domain}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {d.is_primary && (
                          <Badge variant="default" className="text-xs">Primary</Badge>
                        )}
                        {d.is_verified ? (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" /> DNS Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* DNS Instructions */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDnsDialogDomain(d)}
                      title="DNS Setup Instructions"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                    {/* Verify */}
                    {!d.is_verified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verifyDomain(d.id)}
                        disabled={verifying === d.id}
                        title="Verify DNS"
                      >
                        {verifying === d.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {/* Set Primary */}
                    {!d.is_primary && (
                      <Button variant="ghost" size="sm" onClick={() => setPrimary(d.id)} title="Set as primary">
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove domain?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove <strong>{d.domain}</strong>. Users visiting this domain
                            will no longer reach your panel.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeDomain(d.id)}>Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSL Readiness Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            SSL / HTTPS Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cloudflare (Recommended) */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">Recommended</Badge>
                <h4 className="text-sm font-semibold">Cloudflare SSL</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  Free SSL for all domains (including custom)
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  Zero server configuration needed
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  DDoS protection included
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  Auto-renewal, no maintenance
                </li>
              </ul>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  Set SSL mode to <strong>Full (Strict)</strong> in Cloudflare dashboard.
                </p>
              </div>
            </div>

            {/* Let's Encrypt */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Alternative</Badge>
                <h4 className="text-sm font-semibold">Let's Encrypt</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  Free SSL certificates
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  Requires server SSH access
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  Manual cert per custom domain
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  Wildcard needs DNS challenge
                </li>
              </ul>
              <div className="pt-2">
                <code className="text-[10px] bg-muted px-2 py-1 rounded block">
                  certbot --nginx -d yourdomain.com
                </code>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> The system works without SSL during initial setup. 
              We strongly recommend enabling HTTPS before going live. 
              Cloudflare is the easiest option — just proxy your DNS through Cloudflare.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* DNS Instructions Dialog */}
      <DnsInstructionDialog
        domain={dnsDialogDomain}
        subdomain={subdomain}
        onClose={() => setDnsDialogDomain(null)}
      />
    </div>
    </DashboardLayout>
  );
};

// ── DNS Instruction Dialog ──────────────────────────────────
function DnsInstructionDialog({
  domain,
  subdomain,
  onClose,
}: {
  domain: DomainRecord | null;
  subdomain: string;
  onClose: () => void;
}) {
  if (!domain) return null;

  // Parse subdomain & host parts
  const parts = domain.domain.split(".");
  const hostPart = parts.length > 2 ? parts[0] : "@";
  const rootDomain = parts.length > 2 ? parts.slice(1).join(".") : domain.domain;

  return (
    <Dialog open={!!domain} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            DNS Setup for {domain.domain}
          </DialogTitle>
          <DialogDescription>
            Choose one of the options below to point your domain to this panel.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="a-record" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="a-record">Option A: A Record</TabsTrigger>
            <TabsTrigger value="cname">Option B: CNAME</TabsTrigger>
          </TabsList>

          {/* Option A: A Record */}
          <TabsContent value="a-record" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Point your domain directly to the server IP address.
            </p>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-xs">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">Name / Host</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">Value</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">TTL</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">A</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{hostPart}</td>
                    <td className="px-3 py-2 font-mono text-xs">{SERVER_IP_PLACEHOLDER}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">300</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyText(SERVER_IP_PLACEHOLDER)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Where to add:</strong> Go to <strong>{rootDomain}</strong>'s DNS management
                (Namecheap, GoDaddy, Cloudflare, etc.)
              </p>
              <p>
                <strong>Replace</strong> <code className="bg-muted px-1 rounded">{SERVER_IP_PLACEHOLDER}</code> with
                your actual server IP address.
              </p>
            </div>
          </TabsContent>

          {/* Option B: CNAME */}
          <TabsContent value="cname" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Point your domain via CNAME to your default subdomain. Best for Cloudflare users.
            </p>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-xs">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">Name / Host</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">Value</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">TTL</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">CNAME</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{hostPart}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {subdomain ? `${subdomain}.smartispapp.com` : "smartispapp.com"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">300</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyText(subdomain ? `${subdomain}.smartispapp.com` : "smartispapp.com")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Cloudflare users:</strong> Enable the orange proxy cloud icon for automatic SSL.
              </p>
              <p>
                <strong>Note:</strong> CNAME records cannot be used for root/apex domains (e.g. <code className="bg-muted px-1 rounded">yourisp.com</code>).
                Use an A record for root domains, or CNAME flattening if your DNS provider supports it.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Verification Steps */}
        <Separator className="my-2" />
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <ArrowRight className="h-4 w-4" /> After DNS Setup
          </h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Wait 5–30 minutes for DNS propagation (can take up to 48 hours)</li>
            <li>Click the <RefreshCw className="h-3 w-3 inline" /> verify button next to your domain</li>
            <li>Once verified, your domain will automatically serve your billing panel</li>
            <li>Enable SSL via Cloudflare proxy or Let's Encrypt on your server</li>
          </ol>
        </div>

        {/* External Check Link */}
        <div className="flex justify-end mt-2">
          <a
            href={`https://dnschecker.org/#A/${domain.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Check DNS propagation <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DomainManagement;

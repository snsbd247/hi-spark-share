import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface Props {
  resellerId: string;
  tenantId: string;
  defaultCommission: number;
}

export default function ResellerPackageCommissions({ resellerId, tenantId, defaultCommission }: Props) {
  const queryClient = useQueryClient();
  const [commissions, setCommissions] = useState<Record<string, string>>({});

  // Fetch all packages for the tenant
  const { data: packages = [], isLoading: loadingPkgs } = useQuery({
    queryKey: ["tenant-packages-for-commission", tenantId],
    queryFn: async () => {
      const { data } = await (db as any).from("packages")
        .select("id, name, monthly_price")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch existing per-package commissions
  const { data: existingCommissions = [], isLoading: loadingComm } = useQuery({
    queryKey: ["reseller-pkg-commissions", resellerId],
    queryFn: async () => {
      const { data } = await (db as any).from("reseller_package_commissions")
        .select("package_id, commission_amount")
        .eq("reseller_id", resellerId);
      return data || [];
    },
    enabled: !!resellerId,
  });

  // Initialize form from existing data
  useEffect(() => {
    const map: Record<string, string> = {};
    existingCommissions.forEach((c: any) => {
      map[c.package_id] = c.commission_amount?.toString() || "";
    });
    setCommissions(map);
  }, [existingCommissions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const pkg of packages) {
        const val = commissions[pkg.id];
        const amount = parseFloat(val) || 0;
        const existing = existingCommissions.find((c: any) => c.package_id === pkg.id);

        if (amount > 0) {
          if (existing) {
            await (db as any).from("reseller_package_commissions")
              .update({ commission_amount: amount, updated_at: new Date().toISOString() })
              .eq("reseller_id", resellerId)
              .eq("package_id", pkg.id);
          } else {
            await (db as any).from("reseller_package_commissions").insert({
              reseller_id: resellerId,
              package_id: pkg.id,
              tenant_id: tenantId,
              commission_amount: amount,
            });
          }
        } else if (existing) {
          // Remove if set to 0
          await (db as any).from("reseller_package_commissions")
            .delete()
            .eq("reseller_id", resellerId)
            .eq("package_id", pkg.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Package commissions saved");
      queryClient.invalidateQueries({ queryKey: ["reseller-pkg-commissions"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (loadingPkgs || loadingComm) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Package-wise Commission (৳)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Set per-package commission. If empty, default commission (৳{defaultCommission}) will be used.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Commission (৳)</TableHead>
                <TableHead>Tenant Gets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg: any) => {
                const price = parseFloat(pkg.monthly_price) || 0;
                const comm = parseFloat(commissions[pkg.id]) || 0;
                const effectiveComm = comm > 0 ? comm : defaultCommission;
                const tenantGets = Math.max(price - effectiveComm, 0);

                return (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>৳{price}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-24 h-8 text-sm"
                        placeholder={`${defaultCommission}`}
                        value={commissions[pkg.id] || ""}
                        onChange={(e) => setCommissions(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                        min={0}
                        max={price}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">৳{tenantGets}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="p-3 border-t border-border">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save Commissions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

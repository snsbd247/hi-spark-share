import { useState, useEffect } from "react";
import { useModuleSettings, ALL_MODULES } from "@/hooks/useModuleSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ToggleLeft, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function ModuleSettingsTab() {
  const { enabledModules, updateModules, isLoading } = useModuleSettings();
  const { isSuperAdmin } = usePermissions();
  const [localModules, setLocalModules] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalModules(enabledModules);
  }, [enabledModules]);

  const toggleModule = (key: string) => {
    setLocalModules(prev => {
      const next = prev.includes(key)
        ? prev.filter(m => m !== key)
        : [...prev, key];
      setHasChanges(true);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await updateModules.mutateAsync(localModules);
      setHasChanges(false);
      toast.success("Module settings saved! Sidebar will update automatically.");
    } catch {
      toast.error("Failed to save module settings");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground">Access Restricted</h3>
            <p className="text-sm text-muted-foreground">Only Super Admins can enable or disable modules.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALL_MODULES.map(mod => {
            const enabled = enabledModules.includes(mod.key);
            return (
              <Card key={mod.key} className={`transition-opacity ${enabled ? "" : "opacity-60"}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{mod.label}</h3>
                        <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
                          {enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{mod.description}</p>
                    </div>
                    <Switch checked={enabled} disabled />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ToggleLeft className="h-5 w-5" />
            Module Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable modules to customize the system for your needs. Disabled modules will be hidden from the sidebar.
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={updateModules.isPending}>
            {updateModules.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_MODULES.map(mod => {
          const enabled = localModules.includes(mod.key);
          return (
            <Card key={mod.key} className={`transition-opacity ${enabled ? "" : "opacity-60"}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{mod.label}</h3>
                      <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
                        {enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggleModule(mod.key)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Disabling a module hides it from the sidebar navigation for all users. 
            Data and API endpoints remain intact.
            Module permissions for roles are managed separately in the <strong>Roles & Permissions</strong> page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

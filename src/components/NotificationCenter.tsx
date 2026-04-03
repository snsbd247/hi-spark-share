import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Activity } from "lucide-react";

export default function NotificationCenter() {
  return (
    <Card className="glass-card animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Center
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            System Notifications
          </div>
          <p className="text-xs text-muted-foreground text-center py-4">No notifications yet</p>
        </div>
      </CardContent>
    </Card>
  );
}

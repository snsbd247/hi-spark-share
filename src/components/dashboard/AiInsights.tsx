import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb, TrendingDown, TrendingUp, AlertTriangle, MessageSquare,
  Users, CreditCard, Shield,
} from "lucide-react";

interface AiInsightsProps {
  customers?: any[];
  bills?: any[];
  smsBalance?: { balance: number | null; expiry: string | null; rate: number | null };
  collectionRate: number;
  totalDue: number;
  monthlyRevenue: number;
  active: number;
  suspended: number;
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical" | "success";
}

export default function AiInsights({
  customers = [],
  bills = [],
  smsBalance,
  collectionRate,
  totalDue,
  monthlyRevenue,
  active,
  suspended,
}: AiInsightsProps) {
  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];

    // Collection rate analysis
    if (collectionRate < 40) {
      result.push({
        icon: <TrendingDown className="h-4 w-4" />,
        title: "Low Collection Rate",
        description: `Collection rate is only ${collectionRate}%. Consider sending bulk SMS reminders to unpaid customers.`,
        severity: "critical",
      });
    } else if (collectionRate < 70) {
      result.push({
        icon: <TrendingDown className="h-4 w-4" />,
        title: "Collection Below Target",
        description: `Collection rate at ${collectionRate}%. Follow up with overdue customers to improve.`,
        severity: "warning",
      });
    } else if (collectionRate >= 90) {
      result.push({
        icon: <TrendingUp className="h-4 w-4" />,
        title: "Excellent Collection Rate",
        description: `${collectionRate}% collected this month. Great job maintaining payments!`,
        severity: "success",
      });
    }

    // High unpaid invoices
    if (totalDue > 50000) {
      result.push({
        icon: <CreditCard className="h-4 w-4" />,
        title: "High Unpaid Invoices",
        description: `৳${totalDue.toLocaleString()} total unpaid. Consider enabling auto-suspension for overdue accounts.`,
        severity: "warning",
      });
    }

    // SMS balance low
    if (smsBalance?.balance != null && smsBalance.balance < 50) {
      result.push({
        icon: <MessageSquare className="h-4 w-4" />,
        title: "SMS Balance Low",
        description: `Only ৳${smsBalance.balance.toLocaleString()} SMS balance remaining. Recharge to continue sending notifications.`,
        severity: "critical",
      });
    }

    // Suspended customers ratio
    const suspendedRatio = customers.length > 0 ? (suspended / customers.length) * 100 : 0;
    if (suspendedRatio > 20) {
      result.push({
        icon: <Users className="h-4 w-4" />,
        title: "High Suspension Rate",
        description: `${suspendedRatio.toFixed(0)}% customers suspended. Review pricing or offer payment plans to reduce churn.`,
        severity: "warning",
      });
    }

    // Revenue growth suggestion
    if (active < 50 && monthlyRevenue > 0) {
      result.push({
        icon: <TrendingUp className="h-4 w-4" />,
        title: "Growth Opportunity",
        description: `With ${active} active customers, consider marketing campaigns to grow your subscriber base.`,
        severity: "info",
      });
    }

    // Security reminder
    if (customers.length > 100) {
      result.push({
        icon: <Shield className="h-4 w-4" />,
        title: "Enable Auto-Backup",
        description: "With over 100 customers, ensure regular database backups are configured.",
        severity: "info",
      });
    }

    // If no insights, show a positive message
    if (result.length === 0) {
      result.push({
        icon: <TrendingUp className="h-4 w-4" />,
        title: "Everything Looks Good",
        description: "Your ISP is running smoothly. Keep monitoring your dashboard for updates.",
        severity: "success",
      });
    }

    return result.slice(0, 4);
  }, [customers, collectionRate, totalDue, smsBalance, suspended, active, monthlyRevenue]);

  const severityStyles: Record<string, string> = {
    info: "bg-accent/10 text-accent border-accent/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    critical: "bg-destructive/10 text-destructive border-destructive/20",
    success: "bg-success/10 text-success border-success/20",
  };

  const severityBadge: Record<string, string> = {
    info: "bg-accent/20 text-accent",
    warning: "bg-warning/20 text-warning",
    critical: "bg-destructive/20 text-destructive",
    success: "bg-success/20 text-success",
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          AI Insights & Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 rounded-lg border p-3 ${severityStyles[insight.severity]}`}
          >
            <div className="mt-0.5 shrink-0">{insight.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium">{insight.title}</p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${severityBadge[insight.severity]}`}>
                  {insight.severity}
                </Badge>
              </div>
              <p className="text-xs opacity-80">{insight.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

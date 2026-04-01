import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "success" | "destructive" | "warning" | "accent";
  subtitle?: string;
}

const variantStyles: Record<string, string> = {
  default: "from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40",
  success: "from-success/10 to-success/5 border-success/20 hover:border-success/40",
  destructive: "from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40",
  warning: "from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40",
  accent: "from-accent/10 to-accent/5 border-accent/20 hover:border-accent/40",
};

const iconStyles: Record<string, string> = {
  default: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  accent: "bg-accent/15 text-accent",
};

export default function StatCard({ title, value, icon, variant = "default", subtitle }: StatCardProps) {
  return (
    <Card className={`relative overflow-hidden border bg-gradient-to-br ${variantStyles[variant]} p-4 hover-lift stat-glow animate-fade-up`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 truncate animate-count-up">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{subtitle}</p>}
        </div>
        <div className={`flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center ${iconStyles[variant]} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Router, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface DashboardHeroProps {
  userName?: string;
  onRefresh: () => void;
  onBillControl: () => void;
  refreshing: boolean;
  loadingMikrotik: boolean;
  runningBillControl: boolean;
  refreshLabel: string;
  billControlLabel: string;
}

export default function DashboardHero({
  userName, onRefresh, onBillControl, refreshing, loadingMikrotik, runningBillControl,
  refreshLabel, billControlLabel,
}: DashboardHeroProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 5 ? "শুভ রাত্রি" : hour < 12 ? "শুভ সকাল" : hour < 17 ? "শুভ দুপুর" : hour < 20 ? "শুভ বিকেল" : "শুভ সন্ধ্যা";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-6 mb-6 shadow-sm">
      {/* Decorative blob */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{greeting}</p>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-0.5">
              {userName ? `স্বাগতম, ${userName}` : "Dashboard Overview"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium tabular-nums">
              {format(now, "EEEE, dd MMMM yyyy")} · <span className="text-primary">{format(now, "hh:mm:ss a")}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loadingMikrotik} className="bg-background/50 backdrop-blur">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">{refreshLabel}</span>
          </Button>
          <Button size="sm" onClick={onBillControl} disabled={runningBillControl} className="shadow-md shadow-primary/20">
            {runningBillControl ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Router className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">{billControlLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

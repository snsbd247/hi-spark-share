import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface PaymentSummaryCardProps {
  title: string;
  icon: ReactNode;
  loading: boolean;
  todayAmount: number;
  todayCount: number;
  monthAmount: number;
  monthCount: number;
  completed: number;
  pending: number;
  failed: number;
  refunded: number;
  dailyData: { day: string; amount: number }[];
  chartColor: string;
  chartLabel: string;
}

export default function PaymentSummaryCard({
  title, icon, loading,
  todayAmount, todayCount, monthAmount, monthCount,
  completed, pending, failed, refunded,
  dailyData, chartColor, chartLabel,
}: PaymentSummaryCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Today</p>
                <p className="text-xl font-bold text-foreground mt-0.5">৳{todayAmount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{todayCount} txn{todayCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">This Month</p>
                <p className="text-xl font-bold text-foreground mt-0.5">৳{monthAmount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{monthCount} txn{monthCount !== 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Done", val: completed, cls: "text-success" },
                { label: "Pending", val: pending, cls: "text-warning" },
                { label: "Failed", val: failed, cls: "text-destructive" },
                { label: "Refund", val: refunded, cls: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {dailyData.length > 0 && (
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      formatter={(value: number) => [`৳${value.toLocaleString()}`, chartLabel]}
                    />
                    <Bar dataKey="amount" fill={chartColor} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
